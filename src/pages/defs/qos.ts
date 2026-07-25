/**
 * QoS category: EZ QoS (QoS_EZQoS.asp) plus its two "sub-config" pages that
 * QoS_EZQoS.asp's own settingSelection dropdown switches into —
 * Advanced_QOSUserRules_Content.asp (Traditional QoS rule list) and the
 * per-client Bandwidth Limiter table that actually lives inline on
 * QoS_EZQoS.asp itself. No RT-BE92U sysdep overlay exists for any of these
 * three pages.
 *
 * qos_type real values (from the qos_type_radio inputs, id="qos_type_tr"):
 *   0 = Traditional, 1 = Adaptive (Trend Micro DPI, gated adaptiveqos_support),
 *   2 = Bandwidth Limiter, 3 = GeForce NOW QoS (gated geforceNow_support),
 *   9 = Cake (Merlin addition, gated cake_support). There is no separate
 *   "qos_sched" nvram key — Merlin's Cake scheduler is simply qos_type=9;
 *   fq_codel itself is not user-selectable, it is the WAN-facing shaper
 *   AsusWRT always runs underneath Traditional/GeForce-NOW/Bandwidth-Limiter
 *   on codel-capable (arm/aarch64) platforms — codel_support is effectively
 *   always true on this aarch64 unit, so WAN overhead/ATM fields apply
 *   whenever qos_type != 1 (Adaptive hides them; see change_qos_type()).
 *   Cake additionally exposes MPU (qos_mpu), shown only for qos_type==9.
 *
 * Upload/download bandwidth: the page edits Mb/s (obw/ibw text inputs) but
 * stores qos_obw/qos_ibw in nvram as Kb/s = Mb/s * 1024 (validForm():
 * `document.form.qos_obw.value = document.form.obw.value*1024`; reverse in
 * init_changeScale(): `document.form.obw.value = (upload/1024).toFixed(2)`).
 * Modeled here as virtual _mbps fields with derive()/buildFields() doing the
 * *1024 / /1024 conversion, matching the tools-tweaks decomposed-field
 * pattern. A blank/zero stored value means "Auto" (ISP-measured) bandwidth
 * detection on Adaptive/Cake QoS and is round-tripped as an empty string
 * rather than "0.00".
 *
 * Adaptive QoS (qos_type=1) requires Trend Micro EULA acceptance
 * (submitQoS(): `if(qos_type=="1" && TM_EULA.value=="0") { showEulaModal }`)
 * — eulaGate is set on the main 'qos' def since that is where qos_type is
 * edited.
 *
 * action_script: determineActionScript() on QoS_EZQoS.asp is a long
 * multi-branch function (RouterBoost / MTK / Lantiq / HND-CTF / reboot
 * fallbacks); on this Broadcom HND, non-RouterBoost, non-first-time-enable
 * unit the common path it resolves to is "restart_qos;restart_firewall"
 * (action_wait 15) — used verbatim here rather than reimplementing every
 * device-support branch. Advanced_QOSUserRules_Content.asp hard-codes the
 * same action_script/action_wait (5) as static hidden fields, no JS branching
 * involved there.
 *
 * writeExclusion is null for all three defs per explicit operator scoping:
 * QoS restarts (even though the composite action_script also bounces
 * restart_firewall) are not part of this build's 'firewall' hard exclusion
 * — that category is reserved for pages whose primary purpose is firewall
 * rule configuration. confidence.write stays 'unverified-write' regardless
 * (no write in this category has been live-submitted).
 *
 * Out of scope: Advanced_QOSUserPrio_Content.asp (per-priority upload/
 * download bandwidth percentage allocation — qos_orates/qos_irates — and the
 * ACK/SYN/FIN/RST/ICMP prioritization checkboxes qos_ack/qos_syn/qos_fin/
 * qos_rst/qos_icmp) and the Adaptive QoS quick-setup category presets
 * (bwdpi_app_rulelist, the Game/Media/Web/eLearning/videoConference/Customize
 * tiles) — neither was called for in scope and both are deferred.
 */
import type { SettingsPageDef } from '../types';
import { hasFlag } from '../../lib/capabilities';

const yesNo = [
  { value: '1', label: 'Yes' },
  { value: '0', label: 'No' },
];

const QOS_TYPE_OPTIONS = [
  { value: '0', label: 'Traditional QoS' },
  { value: '1', label: 'Adaptive QoS' },
  { value: '2', label: 'Bandwidth Limiter' },
  { value: '3', label: 'GeForce NOW QoS' },
  { value: '9', label: 'Cake' },
];

const PRIORITY_OPTIONS = [
  { value: '0', label: 'Highest' },
  { value: '1', label: 'High' },
  { value: '2', label: 'Medium' },
  { value: '3', label: 'Low' },
  { value: '4', label: 'Lowest' },
];

// ---------------------------------------------------------------------------
// Unit conversions
// ---------------------------------------------------------------------------

/** Main WAN bandwidth fields: stored Kb/s -> displayed Mb/s; 0/blank = Auto. */
function kbToMbpsAuto(kb: string): string {
  const n = Number(kb);
  if (!kb || Number.isNaN(n) || n <= 0) return '';
  return (n / 1024).toFixed(2);
}

function mbpsAutoToKb(mb: string): string {
  const n = Number(mb);
  if (!mb || Number.isNaN(n) || n <= 0) return '0';
  return String(Math.round(n * 1024));
}

/** Per-rule Bandwidth Limiter rates: stored Kb/s -> displayed Mb/s; 0 is a real value here, not "Auto". */
function rateKbToMbps(kb: string): string {
  const n = Number(kb);
  if (!kb || Number.isNaN(n)) return '0';
  return String(Math.round((n / 1024) * 100) / 100);
}

function rateMbpsToKb(mb: string): string {
  const n = Number(mb);
  if (!mb || Number.isNaN(n)) return '0';
  return String(Math.round(n * 1024));
}

// ---------------------------------------------------------------------------
// 1. EZ QoS — QoS_EZQoS.asp
// ---------------------------------------------------------------------------

export const qosPage: SettingsPageDef = {
  kind: 'settings',
  id: 'qos',
  aspPage: 'QoS_EZQoS.asp',
  title: 'QoS',
  navGroup: 'traffic',
  navSub: 'prioritization',
  navOrder: 47,
  navLabel: 'QoS',
  eulaGate: { nvramKeys: ['TM_EULA'], label: 'Adaptive QoS' },
  confidence: { read: 'live-verified', write: 'unverified-write' },
  writeExclusion: null,
  read: {
    nvram: ['qos_enable', 'qos_type', 'qos_overhead', 'qos_atm', 'qos_mpu', 'qos_obw', 'qos_ibw'],
    derive: (raw) => ({
      qos_obw_mbps: kbToMbpsAuto(raw.qos_obw ?? ''),
      qos_ibw_mbps: kbToMbpsAuto(raw.qos_ibw ?? ''),
    }),
  },
  sections: [
    {
      title: 'Basic config',
      fields: [
        { key: 'qos_enable', label: 'Enable QoS', control: 'toggle', options: yesNo },
        {
          key: 'qos_type',
          label: 'QoS Type',
          control: 'select',
          options: QOS_TYPE_OPTIONS,
          hint: 'Adaptive requires Trend Micro EULA acceptance; Adaptive/GeForce NOW/Cake availability depends on this build\'s adaptiveqos_support / geforceNow_support / cake_support flags.',
          showIf: (v) => v.qos_enable === '1',
        },
      ],
    },
    {
      title: 'Bandwidth',
      note: 'Hidden entirely for Bandwidth Limiter (per-client caps are set on the Bandwidth Limiter page instead).',
      showIf: (v) => v.qos_enable === '1' && v.qos_type !== '2',
      fields: [
        {
          key: 'qos_obw_mbps',
          label: 'Upload bandwidth',
          hint: 'Mb/s. Leave blank or 0 for automatic (ISP-measured) rate on Adaptive QoS / Cake. Source bound is effectively unbounded (0-9999999999).',
          control: 'number',
          validate: { min: 0, max: 9999999999 },
        },
        {
          key: 'qos_ibw_mbps',
          label: 'Download bandwidth',
          hint: 'Mb/s. Leave blank or 0 for automatic (ISP-measured) rate on Adaptive QoS / Cake.',
          control: 'number',
          validate: { min: 0, max: 9999999999 },
        },
      ],
    },
    {
      title: 'WAN packet overhead',
      note: 'Shaper accounting overhead for the true WAN link layer (e.g. PPPoE, ATM/PTM DSL). Not applicable to Adaptive QoS.',
      showIf: (v, caps) =>
        v.qos_enable === '1' &&
        v.qos_type !== '1' &&
        (hasFlag(caps, 'cake_support') || hasFlag(caps, 'codel_support')),
      fields: [
        {
          key: 'qos_overhead',
          label: 'Overhead (bytes)',
          control: 'number',
          validate: { min: -64, max: 256 },
        },
        {
          key: 'qos_atm',
          label: 'Link layer mode',
          control: 'select',
          options: [
            { value: '0', label: 'Normal' },
            { value: '1', label: 'ATM' },
            { value: '2', label: 'PTM' },
          ],
        },
        {
          key: 'qos_mpu',
          label: 'MPU (minimum packet unit, bytes)',
          hint: 'Cake only.',
          control: 'number',
          validate: { min: 0, max: 256 },
          showIf: (v, caps) => hasFlag(caps, 'cake_support') && v.qos_type === '9',
        },
      ],
    },
  ],
  write: {
    endpoint: 'applyapp',
    rcService: 'restart_qos;restart_firewall',
    actionWait: 15,
    buildFields: (changed) => {
      const fields: Record<string, string> = {};
      for (const [k, v] of Object.entries(changed)) {
        if (k === 'qos_obw_mbps') fields.qos_obw = mbpsAutoToKb(v);
        else if (k === 'qos_ibw_mbps') fields.qos_ibw = mbpsAutoToKb(v);
        else fields[k] = v;
      }
      return fields;
    },
    buildVerify: (changed) => {
      const expect: Record<string, string> = {};
      for (const [k, v] of Object.entries(changed)) {
        if (k === 'qos_obw_mbps') expect.qos_obw = mbpsAutoToKb(v);
        else if (k === 'qos_ibw_mbps') expect.qos_ibw = mbpsAutoToKb(v);
        else expect[k] = v;
      }
      return expect;
    },
  },
};

// ---------------------------------------------------------------------------
// 2. QoS Rules (Traditional) — Advanced_QOSUserRules_Content.asp
// ---------------------------------------------------------------------------

export const qosRulesPage: SettingsPageDef = {
  kind: 'settings',
  id: 'qos-rules',
  aspPage: 'Advanced_QOSUserRules_Content.asp',
  title: 'QoS Rules (Traditional)',
  navGroup: 'traffic',
  navSub: 'prioritization',
  navOrder: 48,
  navLabel: 'Rules (Traditional)',
  confidence: { read: 'structural', write: 'unverified-write' },
  writeExclusion: null,
  intro:
    'Only takes effect when QoS Type on the main QoS page is set to Traditional QoS. Rules match by client IP/MAC, port, and protocol; unmatched traffic falls back to the default priority below.',
  read: {
    nvram: ['qos_default'],
    nvramAscii: ['qos_rulelist'],
  },
  sections: [
    {
      title: 'Default priority',
      fields: [
        {
          key: 'qos_default',
          label: 'Default priority for unclassified traffic',
          hint: 'Real nvram key (default: Low) but not exposed as a distinct control on the native page — inferred from shared/defaults.c and the same 0-4 scale used by the rule list\'s priority column.',
          control: 'select',
          options: PRIORITY_OPTIONS,
        },
      ],
    },
    {
      title: 'User-defined rules',
      note: 'Record order desc>ip>port>proto>transferred>prio, from the page\'s own save_table()/showqos_rulelist() column indices. Max 128 entries.',
      fields: [
        {
          key: 'qos_rulelist',
          label: 'QoS rules',
          control: 'list',
          ascii: true,
          list: {
            maxRows: 128,
            columns: [
              {
                id: 'desc',
                label: 'Service name',
                validate: { maxLength: 32, pattern: "^[^<>'%]*$", patternHint: "Must not contain < > ' %" },
              },
              {
                id: 'ip',
                label: 'Source IP / MAC',
                mono: true,
                placeholder: '192.168.1.10, 192.168.1.10-20, or MAC',
                validate: {
                  maxLength: 17,
                  pattern: '^(([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2})$|^(\\d{1,3}\\.){3}\\d{1,3}(-\\d{1,3})?$',
                  patternHint: 'IPv4 address, IPv4 range (e.g. 192.168.1.10-20), or MAC address',
                },
              },
              {
                id: 'port',
                label: 'Port range',
                mono: true,
                width: 100,
                validate: { maxLength: 32, pattern: '^\\d{1,5}([:,]\\d{1,5})*$', patternHint: 'Port or start:end range, comma-separated' },
              },
              {
                id: 'proto',
                label: 'Protocol',
                width: 100,
                control: 'select',
                options: [
                  { value: 'tcp', label: 'TCP' },
                  { value: 'udp', label: 'UDP' },
                  { value: 'tcp/udp', label: 'TCP/UDP' },
                  { value: 'any', label: 'ANY' },
                ],
              },
              {
                id: 'transferred',
                label: 'Transferred (KB)',
                mono: true,
                width: 130,
                placeholder: 'min~max',
                validate: { maxLength: 15, pattern: '^\\d*~?\\d*$', patternHint: 'min~max in KB, e.g. 0~1000 (optional)' },
              },
              {
                id: 'prio',
                label: 'Priority',
                width: 100,
                control: 'select',
                options: PRIORITY_OPTIONS,
              },
            ],
          },
        },
      ],
    },
  ],
  write: {
    endpoint: 'applyapp',
    rcService: 'restart_qos;restart_firewall',
    actionWait: 5,
  },
};

// ---------------------------------------------------------------------------
// 3. Bandwidth Limiter — inline table on QoS_EZQoS.asp (list_table/mainTable)
// ---------------------------------------------------------------------------

/**
 * qos_bw_rulelist stored record: enable>target>download_kb>upload_kb>priority
 * (genMain_table()/addRow_main() column indices). Unlike every other rule
 * list on this page family, the native page reads this key with plain
 * nvram_get (then manually un-escapes `&#60`/`&#62`), NOT nvram_char_to_ascii
 * — modeled faithfully with read.nvram, not nvramAscii/ascii:true.
 * download_rate/upload_rate inputs are Mb/s (maxlength 6, one optional
 * decimal digit per validator.bandwidth_code) but the stored columns are
 * Kb/s = Mb/s*1024, same convention as qos_obw/qos_ibw on the main page.
 * Re-exposed here as a Mb/s view (_view) with derive()/buildFields() doing
 * the column-2/3 conversion, keeping the other columns byte-identical.
 */
function bwRuleListFromStored(stored: string): string {
  if (!stored) return '';
  return stored
    .split('<')
    .filter((rec) => rec !== '')
    .map((rec) => {
      const c = rec.split('>');
      return `<${c[0] ?? ''}>${c[1] ?? ''}>${rateKbToMbps(c[2] ?? '')}>${rateKbToMbps(c[3] ?? '')}>${c[4] ?? ''}`;
    })
    .join('');
}

function bwRuleListToStored(view: string): string {
  if (!view) return '';
  return view
    .split('<')
    .filter((rec) => rec !== '')
    .map((rec) => {
      const c = rec.split('>');
      return `<${c[0] ?? ''}>${c[1] ?? ''}>${rateMbpsToKb(c[2] ?? '')}>${rateMbpsToKb(c[3] ?? '')}>${c[4] ?? ''}`;
    })
    .join('');
}

export const bandwidthLimiterPage: SettingsPageDef = {
  kind: 'settings',
  id: 'bandwidth-limiter',
  aspPage: 'QoS_EZQoS.asp',
  title: 'Bandwidth Limiter',
  navGroup: 'traffic',
  navSub: 'prioritization',
  navOrder: 49,
  navLabel: 'Bandwidth Limiter',
  confidence: { read: 'live-verified', write: 'unverified-write' },
  writeExclusion: null,
  intro: 'Only takes effect when QoS Type on the main QoS page is set to Bandwidth Limiter.',
  read: {
    nvram: ['qos_bw_rulelist'],
    derive: (raw) => ({ qos_bw_rulelist_view: bwRuleListFromStored(raw.qos_bw_rulelist ?? '') }),
  },
  sections: [
    {
      title: 'Per-client bandwidth caps',
      note: 'Target may be a client MAC, IP, or IP range (e.g. 192.168.1.5-10); Network Map device-group targeting ("@group") is not modeled. Max 32 entries.',
      fields: [
        {
          key: 'qos_bw_rulelist_view',
          label: 'Bandwidth limiter rules',
          hint: 'Stored in nvram qos_bw_rulelist as Kb/s; edited here in Mb/s.',
          control: 'list',
          list: {
            maxRows: 32,
            columns: [
              {
                id: 'enable',
                label: 'Enabled',
                width: 90,
                control: 'select',
                options: yesNo,
              },
              {
                id: 'target',
                label: 'Target (MAC / IP / IP range)',
                mono: true,
                validate: { required: true, maxLength: 64 },
              },
              {
                id: 'download',
                label: 'Download (Mb/s)',
                width: 130,
                validate: { required: true, maxLength: 6, pattern: '^\\d{1,6}(\\.\\d)?$', patternHint: 'Up to 6 digits, one optional decimal place' },
              },
              {
                id: 'upload',
                label: 'Upload (Mb/s)',
                width: 130,
                validate: { required: true, maxLength: 6, pattern: '^\\d{1,6}(\\.\\d)?$', patternHint: 'Up to 6 digits, one optional decimal place' },
              },
              {
                id: 'priority',
                label: 'Priority rank',
                width: 100,
                validate: { pattern: '^\\d*$' },
              },
            ],
          },
        },
      ],
    },
  ],
  write: {
    endpoint: 'applyapp',
    rcService: 'restart_qos;restart_firewall',
    actionWait: 15,
    buildFields: (changed) => {
      const fields: Record<string, string> = {};
      for (const [k, v] of Object.entries(changed)) {
        if (k === 'qos_bw_rulelist_view') fields.qos_bw_rulelist = bwRuleListToStored(v);
        else fields[k] = v;
      }
      return fields;
    },
    buildVerify: (changed) => {
      const expect: Record<string, string> = {};
      for (const [k, v] of Object.entries(changed)) {
        if (k === 'qos_bw_rulelist_view') expect.qos_bw_rulelist = bwRuleListToStored(v);
        else expect[k] = v;
      }
      return expect;
    },
  },
};

export const qosPages: SettingsPageDef[] = [qosPage, qosRulesPage, bandwidthLimiterPage];
