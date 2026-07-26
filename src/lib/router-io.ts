/**
 * All router I/O. This module runs ONLY in the content script, in the router
 * page's own origin — every request here is a plain same-origin fetch that
 * rides the browser's existing authenticated session cookie, exactly like the
 * native UI's own XHR traffic. The background service worker must never issue
 * a router request (its chrome-extension:// origin is public address space
 * under Local Network Access and the request would be silently gated).
 *
 * Read path (live-verified, docs/LIVE_PROBE_RT-BE92U.md §6):
 *   GET /appGet.cgi?hook=nvram_get(k1)%3Bnvram_get(k2) → {"k1":"v1","k2":"v2"}
 * Because this client keeps no cache, every read here is a forced-fresh read —
 * the equivalent of the native httpApi.nvramGet(keys, true).
 *
 * Write paths (live-verified, docs/WRITE_PATH_CHARACTERIZATION.md):
 *  - applyapp.cgi: POST action_mode=apply&<field>=<value>[&rc_service=...]
 *    Confirmed live to apply a true single-field delta with no effect on
 *    sibling fields. Response is always a bare {"modify":"1"}-style ack that
 *    confirms nothing about resulting state.
 *  - start_apply.htm: the browser form path. Requires the page's ENTIRE
 *    current field set or unrelated fields silently revert to stale values.
 * In both cases the only trustworthy confirmation is a forced-fresh nvram
 * re-read (verifyNvram below). Neither response body is ever authoritative.
 */
import { log } from './log';
import type { WriteExclusionCategory } from './write-policy';

export class RouterAuthError extends Error {
  constructor() {
    super('Router session is not authenticated (redirected to login page)');
    this.name = 'RouterAuthError';
  }
}

export class RouterIOError extends Error {
  constructor(
    message: string,
    public status?: number,
  ) {
    super(message);
    this.name = 'RouterIOError';
  }
}

/** Detect the login page in a response we expected data from. */
function looksLikeLoginPage(text: string): boolean {
  return /Main_Login\.asp|login_filed|asus_token|name="login_authorization"/i.test(text.slice(0, 4000))
    && /<html|<form|<script/i.test(text.slice(0, 400));
}

/**
 * appGet.cgi hook responses are JSON in practice, but the embedded httpd
 * occasionally emits trailing garbage or unescaped control chars. Parse
 * tolerantly; never eval.
 */
function parseAppGetResponse(text: string): Record<string, unknown> {
  const trimmed = text.trim().replace(/;+\s*$/, '');
  try {
    return JSON.parse(trimmed) as Record<string, unknown>;
  } catch {
    // Common failure: raw control characters inside string values.
    try {
      let sanitized = '';
      for (const ch of trimmed) {
        const code = ch.charCodeAt(0);
        sanitized += code < 0x20 && code !== 10 && code !== 9 ? ' ' : ch;
      }
      return JSON.parse(sanitized) as Record<string, unknown>;
    } catch {
      throw new RouterIOError(`appGet.cgi response was not parseable JSON (${trimmed.slice(0, 120)}…)`);
    }
  }
}

async function routerFetch(path: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(path, { credentials: 'same-origin', cache: 'no-store', ...init });
  if (res.status === 404) throw new RouterIOError(`404 for ${path}`, 404);
  if (!res.ok) throw new RouterIOError(`HTTP ${res.status} for ${path}`, res.status);
  return res;
}

/** GET a raw text endpoint (ajax_*.asp feeds, .asp data pages, appGet). */
export async function fetchRouterText(path: string): Promise<string> {
  const res = await routerFetch(path);
  const text = await res.text();
  if (looksLikeLoginPage(text)) throw new RouterAuthError();
  return text;
}

/** Run a batch of appGet.cgi hooks and return the merged JSON object. */
export async function appGet(hooks: string[]): Promise<Record<string, unknown>> {
  if (hooks.length === 0) return {};
  const out: Record<string, unknown> = {};
  // The embedded httpd has a modest URL length tolerance; chunk defensively.
  const CHUNK = 12;
  for (let i = 0; i < hooks.length; i += CHUNK) {
    const batch = hooks.slice(i, i + CHUNK);
    const url = '/appGet.cgi?hook=' + batch.map(encodeURIComponent).join('%3B');
    const text = await fetchRouterText(url);
    Object.assign(out, parseAppGetResponse(text));
  }
  return out;
}

/**
 * Forced-fresh nvram read. No cache exists in this client, so every call is
 * the live value at call time.
 */
export async function nvramGet(keys: string[]): Promise<Record<string, string>> {
  const raw = await appGet(keys.map((k) => `nvram_get(${k})`));
  const out: Record<string, string> = {};
  for (const k of keys) out[k] = String(raw[k] ?? '');
  return out;
}

/**
 * nvram read for values that may contain characters the plain get mangles
 * (SSIDs, passphrases, free-text). Returns DECODED values.
 */
export async function nvramCharToAscii(keys: string[]): Promise<Record<string, string>> {
  const raw = await appGet(keys.map((k) => `nvram_char_to_ascii(${k},${k})`));
  const out: Record<string, string> = {};
  for (const k of keys) {
    // Firmware responses key this either as `<k>` or `<k>_ascii` depending on path.
    const v = raw[k] ?? raw[`${k}_ascii`] ?? '';
    let s = String(v);
    try {
      s = decodeURIComponent(s.replace(/\+/g, '%20'));
    } catch {
      // leave as-is if the escaping was not URI-style
    }
    out[k] = s;
  }
  return out;
}

/** Run a single named hook, e.g. `get_clientlist()`, and return its JSON. */
export async function hookGet(hook: string): Promise<unknown> {
  const raw = await appGet([hook.endsWith(')') ? hook : `${hook}()`]);
  // appGet keys the result by the hook name without parens/args.
  const bare = hook.replace(/\(.*\)$/, '');
  return raw[bare] ?? raw;
}

// ---------------------------------------------------------------------------
// Write layer
// ---------------------------------------------------------------------------

export type WriteEndpoint = 'applyapp' | 'start_apply';

export interface WriteSpec {
  endpoint: WriteEndpoint;
  /**
   * The originating page def's `writeExclusion` category, threaded through so
   * the write chokepoint can enforce it (lib/write-policy.ts). REQUIRED, and
   * deliberately not optional: making it mandatory means a newly added write
   * call site cannot silently omit the category and slip past the hard-
   * exclusion check in guardedWrite(). Pass `null` for uncategorized writes.
   */
  writeExclusion: WriteExclusionCategory;
  /**
   * Override action_mode; default 'apply'. The only other value used is
   * ' Refresh ' (with the literal spaces) — apply_cgi's SystemCmd branch,
   * used by the native UI for command actions like WOL's ether-wake.
   */
  actionMode?: string;
  /** nvram-name → value pairs to submit. For start_apply this must be the page's FULL current field set. */
  fields: Record<string, string>;
  /**
   * Service restart directive. Sent as `rc_service` on applyapp.cgi and as
   * `action_script` on start_apply.htm (same script names, different carrier
   * parameter — confirmed from httpd/web.c apply_cgi()).
   */
  rcService?: string;
  /** start_apply context; ignored for applyapp. */
  actionWait?: number;
  currentPage?: string;
  nextPage?: string;
}

export interface BuiltWriteRequest {
  url: string;
  method: 'POST';
  headers: Record<string, string>;
  body: string;
  spec: WriteSpec;
}

/**
 * Construct — without sending — the exact HTTP request a WriteSpec produces.
 * This is what the read-only interlock displays, what the diagnostics write
 * inspector logs, and what submitWrite() actually sends.
 */
export function buildWriteRequest(spec: WriteSpec): BuiltWriteRequest {
  const params = new URLSearchParams();
  if (spec.endpoint === 'applyapp') {
    params.set('action_mode', spec.actionMode ?? 'apply');
    if (spec.rcService) params.set('rc_service', spec.rcService);
    for (const [k, v] of Object.entries(spec.fields)) params.set(k, v);
    return {
      url: '/applyapp.cgi',
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
      spec,
    };
  }
  // start_apply.htm — the native form path. Whole-page semantics are the
  // caller's responsibility (fields must be the complete current set).
  params.set('action_mode', 'apply');
  if (spec.rcService) params.set('action_script', spec.rcService);
  params.set('action_wait', String(spec.actionWait ?? 5));
  if (spec.currentPage) params.set('current_page', spec.currentPage);
  if (spec.nextPage) params.set('next_page', spec.nextPage);
  params.set('modified', '0');
  for (const [k, v] of Object.entries(spec.fields)) params.set(k, v);
  return {
    url: '/start_apply.htm',
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
    spec,
  };
}

export interface SubmitResult {
  ok: boolean;
  status: number;
  /** Raw response text. NOT authoritative about resulting state — verify with nvram. */
  responseText: string;
}

/**
 * Send a previously built write request. Callers must go through
 * write-guard.ts (guardedWrite) rather than calling this directly, so the
 * read-only interlock and the write log see every write.
 */
export async function submitBuiltWrite(req: BuiltWriteRequest): Promise<SubmitResult> {
  const res = await fetch(req.url, {
    method: req.method,
    credentials: 'same-origin',
    headers: req.headers,
    body: req.body,
  });
  const text = await res.text();
  if (looksLikeLoginPage(text)) throw new RouterAuthError();
  return { ok: res.ok, status: res.status, responseText: text };
}

export interface VerifyResult {
  verified: boolean;
  /** Key → {expected, actual} for every checked key after the final poll. */
  detail: Record<string, { expected: string; actual: string; match: boolean }>;
  attempts: number;
  elapsedMs: number;
}

/**
 * The canonical write confirmation: poll forced-fresh nvram reads until every
 * expected key matches (or timeout). Neither endpoint's response body, nor the
 * DOM, is ever trusted — this is the only reliable method on this hardware.
 */
export async function verifyNvram(
  expected: Record<string, string>,
  opts: { timeoutMs?: number; intervalMs?: number } = {},
): Promise<VerifyResult> {
  const timeoutMs = opts.timeoutMs ?? 10000;
  const intervalMs = opts.intervalMs ?? 800;
  const keys = Object.keys(expected);
  const started = Date.now();
  let attempts = 0;
  let detail: VerifyResult['detail'] = {};
  for (;;) {
    attempts++;
    const actual = await nvramGet(keys);
    detail = {};
    let allMatch = true;
    for (const k of keys) {
      const match = actual[k] === expected[k];
      detail[k] = { expected: expected[k], actual: actual[k], match };
      if (!match) allMatch = false;
    }
    if (allMatch) {
      return { verified: true, detail, attempts, elapsedMs: Date.now() - started };
    }
    if (Date.now() - started + intervalMs > timeoutMs) {
      log.warn('verifyNvram: timed out waiting for nvram to reflect write', detail);
      return { verified: false, detail, attempts, elapsedMs: Date.now() - started };
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
}
