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
 * Advanced_QOSUserPrio_Content.asp (per-priority upload/download bandwidth
 * percentage allocation, qos_orates/qos_irates, and the ACK/SYN/FIN/RST/ICMP
 * prioritization checkboxes qos_ack/qos_syn/qos_fin/qos_rst/qos_icmp) is
 * implemented below as qosUserPrioPage — see its own header comment for the
 * decompose/recompose details.
 *
 * Out of scope: the Adaptive QoS quick-setup category presets
 * (bwdpi_app_rulelist, the Game/Media/Web/eLearning/videoConference/Customize
 * tiles) — not called for in scope, deferred.
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
  title: 'Prioritization Setup',
  navGroup: 'traffic',
  navSub: 'prioritization',
  navOrder: 47,
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
  title: 'Priority Rules',
  navGroup: 'traffic',
  navSub: 'prioritization',
  navOrder: 48,
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
  title: 'Per-Device Speed Limits',
  navGroup: 'traffic',
  navSub: 'prioritization',
  navOrder: 49,
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

// ---------------------------------------------------------------------------
// 4. Priority Bandwidth Allocation — Advanced_QOSUserPrio_Content.asp
// ---------------------------------------------------------------------------

/**
 * qos_orates / qos_irates: comma-joined, 10-slot nvram strings, one slot per
 * traffic priority band (0=Highest..4=Lowest, PRIORITY_OPTIONS order) followed
 * by 5 fixed trailer slots that the native page's own JS always re-appends
 * literally on every save and never lets the user edit
 * (save_options(), Advanced_QOSUserPrio_Content.asp:88-106):
 *
 *   qos_orates: "<min>-<max>" per band (upload %), e.g. default
 *     "80-100,10-100,5-100,3-100,2-95,0-0,0-0,0-0,0-0,0-0" (defaults.c:3051)
 *   qos_irates: "<max>" per band (download %, no min column), e.g. default
 *     "100,100,100,100,100,0,0,0,0,0" (defaults.c:3052)
 *
 * Read: asp:21 (qos_orates), asp:22 (qos_irates), both plain nvram_get — no
 * nvram_char_to_ascii on this page, so read.nvram (not nvramAscii) is used.
 *
 * Decomposed here into per-band virtual fields (qos_orates_min_N/
 * qos_orates_max_N/qos_irates_N, N=0..4, form control ids
 * upload_bw_min_N/upload_bw_max_N/download_bw_max_N natively, asp:307-376)
 * for editing, plus two non-rendered virtual trailer fields
 * (qos_orates_trailer/qos_irates_trailer) that carry slots 5-9 through
 * derive() -> values -> buildFields()/buildVerify() untouched. The trailer is
 * reconstructed from whatever was actually read, not hardcoded to the
 * "0-0"x5 / "0"x5 default literal — defensive in case a router ever has a
 * non-default tail. Only a read that comes back with 5 or fewer slots
 * (malformed/short) falls back to the literal defaults.c tail, so the write
 * is always a well-formed 10-slot string.
 *
 * Bounds: every band's min/max (qos_orates) and max (qos_irates) is a
 * `<select>` populated 0-100 by gen_options()/add_options_value()
 * (asp:156-196, asp:167 `for(var i=0; i<101; i++)`) — modeled as
 * validate: { min: 0, max: 100 }. The native page also enforces, client-side
 * only, upload min <= upload max per band (save_options(), asp:94-98) before
 * allowing submit; this SettingsPageDef framework has no cross-field
 * validation mechanism (FieldValidation in types.ts is per-field only), so
 * that ordering constraint is deliberately NOT reproduced here — do not
 * invent one. Rely on the per-field 0-100 bounds only; a min > max value can
 * be submitted by this page as entered.
 *
 * qos_ack/qos_syn/qos_fin/qos_rst/qos_icmp: plain on/off nvram scalars
 * (asp:471-489, defaults.c:3061-3065), NOT '1'/'0' — modeled with control:
 * 'radio' and explicit 'on'/'off' option values rather than control:
 * 'toggle' (whose nvram-boolean contract in types.ts is specifically
 * '1'/'0').
 *
 * Write mechanism: all nine posted keys (qos_orates, qos_irates, qos_ack,
 * qos_syn, qos_fin, qos_rst, qos_icmp) are literal `router_defaults[]` table
 * entries (defaults.c:3051-3052, 3061-3065) reached through the generic
 * table-driven validate_apply path (web.c:4276/3271) — same classification
 * as every other field in this file, no dedicated do_*_cgi involved.
 * action_mode/action_wait/action_script are static hidden fields on this
 * page (asp:218-220: apply / 5 / "restart_qos;restart_firewall"), matching
 * qosRulesPage's write block exactly.
 *
 * qos_obw/qos_ibw are read and echoed back unchanged by the native page (its
 * WAN-bandwidth manual-entry block is permanently display:none on this page,
 * asp:503-533) — deliberately NOT modeled as editable fields here and never
 * posted, per the research brief (they always round-trip identical on the
 * real page, so omitting them changes nothing observable).
 *
 * qos_type gating: nothing in Advanced_QOSUserPrio_Content.asp branches on
 * qos_type — no redirect, no showIf-equivalent, and this page is reachable
 * from the nav regardless of the router's current QoS Type. It only *takes
 * effect* when QoS Type (on the main QoS page) is Traditional (qos_type=0) —
 * a documentation-level constraint, not a code gate. Mirrors qosRulesPage
 * exactly: no showIf/gate keyed on qos_type, just an `intro` note.
 *
 * writeExclusion: null, deliberately, matching all three existing QoS defs
 * above (see the file header comment) — this page's action_script is the
 * identical restart_qos;restart_firewall pair already accepted there, and
 * QoS pages are not what this build's 'firewall' hard-exclusion category is
 * reserved for. This is a reviewed decision, not an omission.
 *
 * confidence: { read: 'structural', write: 'unverified-write' } — sourced
 * from firmware source analysis only; this write path has never been
 * live-submitted against real hardware.
 */
const ORATES_DEFAULT_TRAILER = '0-0,0-0,0-0,0-0,0-0';
const IRATES_DEFAULT_TRAILER = '0,0,0,0,0';

function decomposeOrates(joined: string): Record<string, string> {
  const slots = (joined ?? '').split(',');
  const out: Record<string, string> = {};
  for (let i = 0; i < 5; i++) {
    const [min, max] = (slots[i] ?? '').split('-');
    out[`qos_orates_min_${i}`] = min ?? '';
    out[`qos_orates_max_${i}`] = max ?? '';
  }
  out.qos_orates_trailer = slots.length > 5 ? slots.slice(5).join(',') : ORATES_DEFAULT_TRAILER;
  return out;
}

function decomposeIrates(joined: string): Record<string, string> {
  const slots = (joined ?? '').split(',');
  const out: Record<string, string> = {};
  for (let i = 0; i < 5; i++) {
    out[`qos_irates_${i}`] = slots[i] ?? '';
  }
  out.qos_irates_trailer = slots.length > 5 ? slots.slice(5).join(',') : IRATES_DEFAULT_TRAILER;
  return out;
}

function joinOrates(all: Record<string, string>): string {
  const bands = Array.from(
    { length: 5 },
    (_, i) => `${all[`qos_orates_min_${i}`] || '0'}-${all[`qos_orates_max_${i}`] || '0'}`,
  );
  return `${bands.join(',')},${all.qos_orates_trailer || ORATES_DEFAULT_TRAILER}`;
}

function joinIrates(all: Record<string, string>): string {
  const bands = Array.from({ length: 5 }, (_, i) => all[`qos_irates_${i}`] || '0');
  return `${bands.join(',')},${all.qos_irates_trailer || IRATES_DEFAULT_TRAILER}`;
}

const onOff = [
  { value: 'on', label: 'Yes' },
  { value: 'off', label: 'No' },
];

function orateFields() {
  return PRIORITY_OPTIONS.flatMap((p, i) => [
    {
      key: `qos_orates_min_${i}`,
      label: `${p.label} priority: upload min %`,
      control: 'number' as const,
      validate: { min: 0, max: 100, required: true },
    },
    {
      key: `qos_orates_max_${i}`,
      label: `${p.label} priority: upload max %`,
      control: 'number' as const,
      validate: { min: 0, max: 100, required: true },
    },
  ]);
}

function irateFields() {
  return PRIORITY_OPTIONS.map((p, i) => ({
    key: `qos_irates_${i}`,
    label: `${p.label} priority: download max %`,
    control: 'number' as const,
    validate: { min: 0, max: 100, required: true },
  }));
}

export const qosUserPrioPage: SettingsPageDef = {
  kind: 'settings',
  id: 'qos-userprio',
  aspPage: 'Advanced_QOSUserPrio_Content.asp',
  title: 'Priority Bandwidth Allocation',
  navGroup: 'traffic',
  navSub: 'prioritization',
  navOrder: 50,
  confidence: { read: 'structural', write: 'unverified-write' },
  writeExclusion: null,
  intro:
    'Only takes effect when QoS Type on the main QoS page is set to Traditional QoS. Sets the upload/download bandwidth percentage each priority band may use; there is no constraint that the five bands sum to 100%.',
  read: {
    nvram: ['qos_orates', 'qos_irates'],
    derive: (raw) => ({
      ...decomposeOrates(raw.qos_orates ?? ''),
      ...decomposeIrates(raw.qos_irates ?? ''),
    }),
  },
  sections: [
    {
      title: 'Upload allocation (qos_orates)',
      note: 'Min <= max is enforced natively client-side but not reproduced here (see header comment) — only the 0-100 per-field bound is checked.',
      fields: orateFields(),
    },
    {
      title: 'Download allocation (qos_irates)',
      fields: irateFields(),
    },
    {
      title: 'TCP control-packet priority boost',
      fields: [
        { key: 'qos_ack', label: 'Prioritize ACK packets', control: 'radio', options: onOff },
        { key: 'qos_syn', label: 'Prioritize SYN packets', control: 'radio', options: onOff },
        { key: 'qos_fin', label: 'Prioritize FIN packets', control: 'radio', options: onOff },
        { key: 'qos_rst', label: 'Prioritize RST packets', control: 'radio', options: onOff },
        { key: 'qos_icmp', label: 'Prioritize ICMP packets', control: 'radio', options: onOff },
      ],
    },
  ],
  write: {
    endpoint: 'applyapp',
    rcService: 'restart_qos;restart_firewall',
    actionWait: 5,
    buildFields: (changed, all) => {
      const fields: Record<string, string> = {};
      let oratesTouched = false;
      let iratesTouched = false;
      for (const key of Object.keys(changed)) {
        if (key.startsWith('qos_orates_')) oratesTouched = true;
        else if (key.startsWith('qos_irates_')) iratesTouched = true;
        else fields[key] = changed[key];
      }
      if (oratesTouched) fields.qos_orates = joinOrates(all);
      if (iratesTouched) fields.qos_irates = joinIrates(all);
      return fields;
    },
    buildVerify: (changed, all) => {
      const expect: Record<string, string> = {};
      let oratesTouched = false;
      let iratesTouched = false;
      for (const key of Object.keys(changed)) {
        if (key.startsWith('qos_orates_')) oratesTouched = true;
        else if (key.startsWith('qos_irates_')) iratesTouched = true;
        else expect[key] = changed[key];
      }
      if (oratesTouched) expect.qos_orates = joinOrates(all);
      if (iratesTouched) expect.qos_irates = joinIrates(all);
      return expect;
    },
  },
};

export const qosPages: SettingsPageDef[] = [qosPage, qosRulesPage, bandwidthLimiterPage, qosUserPrioPage];
