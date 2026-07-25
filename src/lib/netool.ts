/**
 * Client for netool.cgi — the 3006-generation diagnostics endpoint the native
 * Network Tools pages use (Main_Analysis_Content.asp / Main_Netstat_Content.asp,
 * RT-BE92U overlays). GET /netool.cgi?type=N&target=… starts a command and
 * returns {"successful":"<resultFile>"}; polling type=0&target=<resultFile>
 * returns the accumulated output. Text output terminates with the firmware's
 * literal sentinel "XU6J03M6".
 *
 * These calls make the router RUN a diagnostic (ping/traceroute/nslookup/
 * netstat) — no configuration is touched, but starting one is always a
 * user-clicked action in this UI, never automatic.
 */
import { fetchRouterText } from './router-io';

export const NETOOL_TYPES = {
  pingContinuous: '1',
  ping: '3',
  traceroute: '4',
  nslookup: '5',
  netstat: '6',
  netstatNat: '7',
} as const;

const TEXT_SENTINEL = 'XU6J03M6';

export interface NetoolStart {
  type: string;
  target: string;
  pcnt?: string;
  ver?: 'v4' | 'v6' | '';
  /** netstat-nat option string (page passes e.g. resolved/source filters). */
  opt?: string;
}

export async function netoolStart(req: NetoolStart): Promise<string> {
  const params = new URLSearchParams();
  params.set('type', req.type);
  params.set('target', req.target);
  if (req.pcnt) params.set('pcnt', req.pcnt);
  if (req.ver) params.set('ver', req.ver);
  if (req.opt) params.set('opt', req.opt);
  const text = await fetchRouterText('/netool.cgi?' + params.toString());
  try {
    const json = JSON.parse(text) as { successful?: string };
    if (json.successful && json.successful !== '0') return json.successful;
  } catch {
    // fall through
  }
  throw new Error(`netool.cgi did not start the command (${text.slice(0, 120)})`);
}

/**
 * Poll a text-mode result until the sentinel appears (or maxMs elapses).
 * onUpdate receives progressively longer output with the sentinel stripped.
 */
export async function netoolPollText(
  resultFile: string,
  onUpdate: (text: string) => void,
  opts: { intervalMs?: number; maxMs?: number } = {},
): Promise<string> {
  const intervalMs = opts.intervalMs ?? 800;
  const maxMs = opts.maxMs ?? 90000;
  const started = Date.now();
  for (;;) {
    const raw = await fetchRouterText(`/netool.cgi?type=0&target=${encodeURIComponent(resultFile)}`);
    const done = raw.includes(TEXT_SENTINEL);
    const text = raw.replace(TEXT_SENTINEL, '').replace(/^\{"result":/, '').replace(/\}\s*$/, '');
    onUpdate(text);
    if (done) return text;
    if (Date.now() - started > maxMs) throw new Error('netool command timed out');
    await new Promise((r) => setTimeout(r, intervalMs));
  }
}

export interface PingSample {
  ping: number;
  loss: number;
}

/** Poll one continuous-ping sample (JSON result mode, type=1). */
export async function netoolPollPing(resultFile: string): Promise<PingSample> {
  const raw = await fetchRouterText(`/netool.cgi?type=0&target=${encodeURIComponent(resultFile)}`);
  const json = JSON.parse(raw) as { result?: { ping?: string; loss?: string }[] };
  const r = json.result?.[0] ?? {};
  return { ping: r.ping ? parseFloat(r.ping) : 0, loss: r.loss ? parseInt(r.loss, 10) : 0 };
}
