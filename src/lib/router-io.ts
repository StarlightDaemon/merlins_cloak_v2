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
  /**
   * The native page's own client-side wait for this operation, in SECONDS.
   *
   * Two distinct uses, and only the first is a wire parameter:
   *  - on start_apply.htm it is sent as the `action_wait` form field, which is
   *    what the native form path does;
   *  - on BOTH endpoints it is the wait-before-first-confirmation-read. The
   *    router does not receive it on applyapp.cgi (that endpoint has no such
   *    field), but the value is still the best per-path estimate of how long
   *    the operation takes, so the verifier settles for that long before its
   *    first forced-fresh re-read rather than polling a router that is still
   *    restarting. See lib/write-policy.ts confirmWindow().
   */
  actionWait?: number;
  /**
   * Per-path override for the confirmation ceiling, in ms. Normally unset —
   * confirmWindow() derives a ceiling from `actionWait` and the exclusion
   * category. Set this only where a path's real settle time is known to differ
   * from both. Purely a confirmation-timing control: it does not affect what is
   * submitted or whether the write is permitted.
   */
  confirmTimeoutMs?: number;
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

export interface VerifyOptions {
  /**
   * ms to wait after the write before issuing the FIRST forced-fresh read.
   * Derived from the path's `actionWait`; see write-policy.ts confirmWindow().
   */
  settleMs?: number;
  /** Total ms budget, measured from entry and INCLUDING settleMs. */
  timeoutMs?: number;
  intervalMs?: number;
}

export interface VerifyResult {
  verified: boolean;
  /** Key → {expected, actual} for every checked key after the final poll. */
  detail: Record<string, { expected: string; actual: string; match: boolean }>;
  /** Read attempts issued, whether or not they returned an answer. */
  attempts: number;
  /**
   * Attempts that actually returned a readable answer. `reads === 0` means the
   * router never answered inside the window, so the result is UNKNOWN — not a
   * failed write. `detail` is empty in that case.
   */
  reads: number;
  /** Total ms from entry, settle included. */
  elapsedMs: number;
  /** The settle delay actually applied before the first read. */
  settleMs: number;
  /** The ceiling this run was given, for reporting alongside the verdict. */
  timeoutMs: number;
  /** Last read failure seen. Reporting only; never a verdict on its own. */
  lastError?: string;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * The canonical write confirmation: wait out the path's expected settle time,
 * then poll forced-fresh nvram reads until every expected key matches or the
 * budget is exhausted. Neither endpoint's response body, nor the DOM, is ever
 * trusted — a matching forced-fresh read is the only thing that sets
 * `verified`, and this is the only reliable method on this hardware.
 *
 * Reads that fail mid-window are expected on any restart-bearing path (the
 * router is unreachable while the service or the box comes back) and are
 * tolerated: they consume budget and are recorded, but they do not end the
 * loop and they never produce a verdict. A lost session is the exception —
 * further polling cannot succeed, so it stops and says so.
 */
export async function verifyNvram(
  expected: Record<string, string>,
  opts: VerifyOptions = {},
): Promise<VerifyResult> {
  const timeoutMs = Math.max(0, opts.timeoutMs ?? 10000);
  const intervalMs = Math.max(50, opts.intervalMs ?? 800);
  const settleMs = Math.max(0, Math.min(opts.settleMs ?? 0, timeoutMs));
  const keys = Object.keys(expected);
  const started = Date.now();
  let attempts = 0;
  let reads = 0;
  let lastError: string | undefined;
  let detail: VerifyResult['detail'] = {};
  const result = (verified: boolean): VerifyResult => ({
    verified,
    detail,
    attempts,
    reads,
    elapsedMs: Date.now() - started,
    settleMs,
    timeoutMs,
    lastError,
  });

  if (settleMs > 0) {
    log.info(`verifyNvram: settling ${settleMs}ms (action_wait) before the first confirmation read`);
    await sleep(settleMs);
  }

  for (;;) {
    attempts++;
    try {
      const actual = await nvramGet(keys);
      reads++;
      lastError = undefined;
      detail = {};
      let allMatch = true;
      for (const k of keys) {
        const match = actual[k] === expected[k];
        detail[k] = { expected: expected[k], actual: actual[k], match };
        if (!match) allMatch = false;
      }
      if (allMatch) return result(true);
    } catch (e) {
      if (e instanceof RouterAuthError) {
        lastError = e.message;
        log.warn('verifyNvram: router session lost, cannot confirm this write', e.message);
        return result(false);
      }
      lastError = e instanceof Error ? e.message : String(e);
      log.info('verifyNvram: read failed inside the confirmation window, still polling', lastError);
    }
    // Stop only once the budget is genuinely spent, and never sleep past it, so
    // the last read lands ON the ceiling rather than one interval short of it.
    const remaining = timeoutMs - (Date.now() - started);
    if (remaining <= 0) {
      log.warn(
        `verifyNvram: ${timeoutMs}ms window closed with no matching nvram read (${reads} of ${attempts} reads answered)`,
        detail,
        lastError ?? '',
      );
      return result(false);
    }
    await sleep(Math.min(intervalMs, remaining));
  }
}
