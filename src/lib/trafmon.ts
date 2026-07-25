/**
 * Traffic monitor data layer — update.cgi, the Tomato-heritage bandwidth
 * endpoint Merlin's traffic pages poll:
 *   /update.cgi?output=netdev            → netdev = {'INTERNET':{rx:0x…,tx:0x…},…}
 *   /update.cgi?output=bandwidth&arg0=speed   → speed_history = {ifname:{rx:[…],tx:[…]},…}
 *   /update.cgi?output=bandwidth&arg0=daily   → daily_history = [[ymd,rx,tx],…]
 *   /update.cgi?output=bandwidth&arg0=monthly → monthly_history = [[ym,rx,tx],…]
 * All of it is JavaScript source with single-quoted keys, bare keys, and hex
 * literals (httpd/web.c: "'%s':{rx:0x%llx,tx:0x%llx}"), so it is normalized
 * to JSON before parsing. Counter values can exceed 2^53 in theory; precision
 * loss there matches the native UI's own JS-number handling.
 */
import { fetchRouterText } from './router-io';

/** Normalize the endpoint's JS-literal syntax to strict JSON. */
export function jsLiteralToJson(src: string): string {
  return src
    .replace(/0x[0-9a-fA-F]+/g, (h) => String(parseInt(h, 16)))
    .replace(/'([^']*)'/g, '"$1"')
    .replace(/([{,]\s*)([A-Za-z_$][\w$]*)\s*:/g, '$1"$2":');
}

function extractAssignment(text: string, name: string): string | null {
  const idx = text.indexOf(name);
  if (idx === -1) return null;
  const eq = text.indexOf('=', idx);
  if (eq === -1) return null;
  const open = text.slice(eq).search(/[[{]/);
  if (open === -1) return null;
  const start = eq + open;
  const openCh = text[start];
  const closeCh = openCh === '[' ? ']' : '}';
  let depth = 0;
  for (let i = start; i < text.length; i++) {
    if (text[i] === openCh) depth++;
    else if (text[i] === closeCh) {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

export interface NetdevCounters {
  [ifname: string]: { rx: number; tx: number };
}

export async function fetchNetdev(): Promise<NetdevCounters> {
  const text = await fetchRouterText('/update.cgi?output=netdev');
  const body = extractAssignment(text, 'netdev');
  if (!body) throw new Error('update.cgi netdev output not recognized');
  return JSON.parse(jsLiteralToJson(body)) as NetdevCounters;
}

export interface SpeedHistory {
  [ifname: string]: { rx: number[]; tx: number[] };
}

export async function fetchSpeedHistory(): Promise<SpeedHistory> {
  const text = await fetchRouterText('/update.cgi?output=bandwidth&arg0=speed');
  const body = extractAssignment(text, 'speed_history');
  if (!body) throw new Error('update.cgi speed output not recognized');
  const parsed = JSON.parse(jsLiteralToJson(body)) as Record<string, { rx?: unknown[]; tx?: unknown[] }>;
  const out: SpeedHistory = {};
  for (const [k, v] of Object.entries(parsed)) {
    out[k] = { rx: (v.rx ?? []).map(Number), tx: (v.tx ?? []).map(Number) };
  }
  return out;
}

export interface HistoryEntry {
  /** Tomato-packed date: ((year-1900)<<16)|(month<<8)|day; month 0-based. */
  packed: number;
  rx: number;
  tx: number;
}

export function unpackDate(packed: number): { year: number; month: number; day: number } {
  return { year: 1900 + ((packed >> 16) & 0xff), month: (packed >> 8) & 0xff, day: packed & 0xff };
}

async function fetchHistory(arg0: 'daily' | 'monthly', varName: string): Promise<HistoryEntry[]> {
  const text = await fetchRouterText(`/update.cgi?output=bandwidth&arg0=${arg0}`);
  const body = extractAssignment(text, varName);
  if (!body) throw new Error(`update.cgi ${arg0} output not recognized`);
  const rows = JSON.parse(jsLiteralToJson(body)) as unknown[];
  return rows
    .filter((r): r is number[] => Array.isArray(r) && r.length >= 3)
    .map((r) => ({ packed: r[0], rx: r[1], tx: r[2] }))
    .sort((a, b) => b.packed - a.packed);
}

export const fetchDailyHistory = (): Promise<HistoryEntry[]> => fetchHistory('daily', 'daily_history');
export const fetchMonthlyHistory = (): Promise<HistoryEntry[]> => fetchHistory('monthly', 'monthly_history');

export function fmtBytes(n: number): string {
  if (!Number.isFinite(n)) return '—';
  if (n >= 1024 ** 4) return `${(n / 1024 ** 4).toFixed(2)} TB`;
  if (n >= 1024 ** 3) return `${(n / 1024 ** 3).toFixed(2)} GB`;
  if (n >= 1024 ** 2) return `${(n / 1024 ** 2).toFixed(2)} MB`;
  if (n >= 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${n} B`;
}

export function fmtRate(bytesPerSec: number): string {
  return `${fmtBytes(bytesPerSec)}/s`;
}
