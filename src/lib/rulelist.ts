/**
 * The AsusWRT nvram rule-list encoding, used by dozens of settings
 * (vts_rulelist, dhcp_staticlist, vpndirector_rulelist, keyword_rulelist, …):
 * records separated by '<', fields within a record by '>'. A non-empty list
 * conventionally begins with a leading '<' (confirmed in page source:
 * `dhcp_staticlists.split('&#60')` yields an empty first element).
 *
 * Records are modeled as string arrays aligned to a ListSpec's columns.
 * Parsing is defensive: missing trailing fields become '' (older firmware
 * wrote shorter records for the same key).
 */
import type { ListSpec } from '../pages/types';

export function parseRuleList(raw: string, spec: ListSpec): string[][] {
  const recordSep = spec.recordSep ?? '<';
  const fieldSep = spec.fieldSep ?? '>';
  if (!raw) return [];
  return raw
    .split(recordSep)
    .filter((rec) => rec !== '')
    .map((rec) => {
      const cells = rec.split(fieldSep);
      return spec.columns.map((_, i) => cells[i] ?? '');
    });
}

export function serializeRuleList(rows: string[][], spec: ListSpec): string {
  const recordSep = spec.recordSep ?? '<';
  const fieldSep = spec.fieldSep ?? '>';
  if (rows.length === 0) return '';
  const body = rows.map((r) => r.join(fieldSep)).join(recordSep);
  return (spec.leadingSep ?? true) ? recordSep + body : body;
}
