/**
 * Parental Controls (ParentalControl.asp) — per-client time scheduling / full
 * block. No RT-BE92U sysdep overlay exists for this page.
 *
 * Four nvram keys carry one flat, index-aligned record per client, joined
 * with '>' — NOT the usual '<' rule-list record separator, and with NO
 * leading '>' (confirmed in the page's own encode/decode):
 *   initial(): MULTIFILTER_ENABLE_row = MULTIFILTER_ENABLE.split('>'); … (same
 *     for MAC / DEVICENAME / MACFILTER_DAYTIME_V2)
 *   applyRule(): MULTIFILTER_ENABLE += ((index > 0) ? (">" + enable) : enable);
 *     (identical accumulation pattern for the other three keys)
 * MULTIFILTER_DEVICENAME is read through nvram_char_to_ascii; the other three
 * through plain nvram_get.
 *
 * MULTIFILTER_MACFILTER_DAYTIME_V2's per-client value is itself a '<'-joined
 * list of fixed-width 12-char schedule tokens (js/weekSchedule/weekSchedule.js
 * PC_init_data / PC_transform_offtime_json_to_string):
 *   offset  0    mode: 'W' (offline/weekly) or 'M' (online), effectively
 *                always 'W' unless PC_SCHED_V3 >= 3 support is present
 *   offset  1    enable: '0' or '1' for this specific rule
 *   offset 2-3   weekday bitmask, 2 hex digits (Sun=0x01 Mon=0x02 Tue=0x04
 *                Wed=0x08 Thu=0x10 Fri=0x20 Sat=0x40, summed);
 *                0x7F = Daily, 0x3E = Weekdays, 0x41 = Weekend
 *   offset 4-5   start hour, 2 decimal digits (00-23)
 *   offset 6-7   start minute, 2 decimal digits (00-59)
 *   offset 8-9   end hour, 2 decimal digits (00-23)
 *   offset 10-11 end minute, 2 decimal digits (00-59)
 * e.g. "W03E21000700" decodes to mode W, enable 0, weekday 0x3E (Weekdays),
 * 21:00-07:00. Multiple tokens for one client are joined with '<'.
 *
 * The four parallel lists are too tightly coupled (same index = same client)
 * for four independent list fields, so they are edited here as ONE virtual
 * list field ('parental_rules_view', tools-tweaks joined/decomposed pattern
 * generalized to a table). Its own wire encoding is private to this file —
 * recordSep '\n' / fieldSep '\t', chosen because neither character can occur
 * in an enable digit, a MAC, a device name (validated below), or a V2
 * schedule string (digits/hex/'<'/'W'/'M') — and is recomposed into the four
 * real '>'-joined nvram strings by parentalViewToRaw() on write.
 *
 * action_script=restart_firewall (action_wait 5): parental filtering is
 * implemented as iptables rules, so this falls under the operator's
 * 'firewall' hard exclusion like the dedicated firewall pages.
 */
import { parseRuleList, serializeRuleList } from '../../lib/rulelist';
import type { ListSpec, SettingsPageDef } from '../types';

const MAC_PATTERN = '^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$';
const MAC_HINT = 'MAC as AA:BB:CC:DD:EE:FF';
/** One 12-char V2 token, optionally several joined by '<'. See file header. */
const SCHEDULE_PATTERN = '^$|^[WM][01][0-9A-Fa-f]{2}\\d{8}(<[WM][01][0-9A-Fa-f]{2}\\d{8})*$';
const SCHEDULE_HINT =
  "Empty, or one or more 12-char tokens joined by '<': mode(W/M)+enable(0/1)+weekday-hex(2)+startHH+startMM+endHH+endMM";
/** '>' is the real record separator for the four backing nvram keys; keep it out of free-text names. */
const DEVICENAME_PATTERN = '^[^<>]*$';

const PARENTAL_VIEW_SPEC: ListSpec = {
  recordSep: '\n',
  fieldSep: '\t',
  leadingSep: false,
  // MaxRule_parentctrl (rc_support token); native default when unsupported is 16.
  maxRows: 16,
  addLabel: '+ Add device',
  columns: [
    {
      id: 'enable',
      label: 'Mode',
      width: 140,
      control: 'select',
      options: [
        { value: '0', label: 'Disabled' },
        { value: '1', label: 'Time Scheduling' },
        { value: '2', label: 'Block' },
      ],
    },
    { id: 'mac', label: 'MAC address', mono: true, placeholder: 'AA:BB:CC:DD:EE:FF', validate: { required: true, pattern: MAC_PATTERN, patternHint: MAC_HINT } },
    { id: 'devicename', label: 'Device name', validate: { maxLength: 32, pattern: DEVICENAME_PATTERN, patternHint: "Must not contain < or >" } },
    {
      id: 'schedule',
      label: 'Time schedule (raw)',
      mono: true,
      // weekScheduleApi.data_max (isSupport("MaxRule_PC_DAYTIME"), default 128)
      // is a shared budget across ALL clients' rules combined, not per-client;
      // 128 tokens * 12 chars + 127 '<' separators = 1663 is the absolute
      // worst case for one client holding the entire budget.
      validate: { maxLength: 1663, pattern: SCHEDULE_PATTERN, patternHint: SCHEDULE_HINT },
    },
  ],
};

/** Raw MULTIFILTER_* nvram reads → the single virtual view string. */
function parentalViewFromRaw(raw: Record<string, string>): string {
  const macRaw = raw.MULTIFILTER_MAC ?? '';
  if (!macRaw) return '';
  const enable = (raw.MULTIFILTER_ENABLE ?? '').split('>');
  const mac = macRaw.split('>');
  const name = (raw.MULTIFILTER_DEVICENAME ?? '').split('>');
  const sched = (raw.MULTIFILTER_MACFILTER_DAYTIME_V2 ?? '').split('>');
  const rows = mac.map((m, i) => [enable[i] ?? '1', m, name[i] ?? '', sched[i] ?? '']);
  return serializeRuleList(rows, PARENTAL_VIEW_SPEC);
}

/** Edited view string → the four real, index-aligned '>'-joined nvram strings. */
function parentalViewToRaw(view: string): Record<string, string> {
  const rows = parseRuleList(view, PARENTAL_VIEW_SPEC);
  return {
    MULTIFILTER_ENABLE: rows.map((r) => r[0] ?? '').join('>'),
    MULTIFILTER_MAC: rows.map((r) => r[1] ?? '').join('>'),
    MULTIFILTER_DEVICENAME: rows.map((r) => r[2] ?? '').join('>'),
    MULTIFILTER_MACFILTER_DAYTIME_V2: rows.map((r) => r[3] ?? '').join('>'),
  };
}

export const parentalControlPage: SettingsPageDef = {
  kind: 'settings',
  id: 'parental',
  aspPage: 'ParentalControl.asp',
  title: 'Parental Controls — Time Scheduling',
  navGroup: 'parental',
  navLabel: 'Time Scheduling',
  confidence: { read: 'structural', write: 'unverified-write' },
  writeExclusion: 'firewall',
  intro:
    'Per-client access control: block a device outright, or restrict it to a weekly time schedule. Applies via iptables (restart_firewall).',
  read: {
    nvram: ['MULTIFILTER_ALL', 'MULTIFILTER_ENABLE', 'MULTIFILTER_MAC', 'MULTIFILTER_MACFILTER_DAYTIME_V2'],
    nvramAscii: ['MULTIFILTER_DEVICENAME'],
    derive: (raw) => ({ parental_rules_view: parentalViewFromRaw(raw) }),
  },
  sections: [
    {
      title: 'Basic config',
      fields: [
        {
          key: 'MULTIFILTER_ALL',
          label: 'Enable Parental Controls',
          control: 'radio',
          options: [
            { value: '1', label: 'Enabled' },
            { value: '0', label: 'Disabled' },
          ],
        },
      ],
    },
    {
      title: 'Client schedules',
      note:
        "One row per client (MULTIFILTER_ENABLE / MULTIFILTER_MAC / MULTIFILTER_DEVICENAME / MULTIFILTER_MACFILTER_DAYTIME_V2, index-aligned). " +
        'The schedule column is the raw encoded token string — see the field hint for the format; the native page edits it through a visual weekly grid this table does not reproduce.',
      showIf: (v) => v.MULTIFILTER_ALL === '1',
      fields: [
        {
          key: 'parental_rules_view',
          label: 'Per-client rules',
          hint: 'Recomposed into MULTIFILTER_ENABLE / MULTIFILTER_MAC / MULTIFILTER_DEVICENAME / MULTIFILTER_MACFILTER_DAYTIME_V2 on write',
          control: 'list',
          list: PARENTAL_VIEW_SPEC,
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
        if (k === 'parental_rules_view') Object.assign(fields, parentalViewToRaw(v));
        else fields[k] = v;
      }
      return fields;
    },
    buildVerify: (changed) => {
      const expect: Record<string, string> = {};
      for (const [k, v] of Object.entries(changed)) {
        if (k === 'parental_rules_view') Object.assign(expect, parentalViewToRaw(v));
        else expect[k] = v;
      }
      return expect;
    },
  },
};

export const parentalPages: SettingsPageDef[] = [parentalControlPage];
