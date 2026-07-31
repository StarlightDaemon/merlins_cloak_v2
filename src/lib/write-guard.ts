/**
 * The single gate every router write passes through.
 *
 * Responsibilities:
 *  - Enforce the hard write exclusions (lib/write-policy.ts) UNCONDITIONALLY.
 *    This check runs before the read-only check and is not governed by it:
 *    a write in a hard-excluded category is refused whether read-only mode is
 *    on or off. See write-policy.ts for why.
 *  - Enforce read-only mode: when on, guardedWrite() constructs the request,
 *    records it in the write log, and returns WITHOUT sending. The UI shows
 *    the operator exactly what would have been sent.
 *  - Keep an in-memory write log (constructed + submitted requests, verify
 *    results) surfaced in the diagnostics view.
 *  - Run the mandatory poll-and-verify after every real submit: neither write
 *    endpoint's response confirms anything; only a forced-fresh nvram re-read
 *    does. The confirmation window is resolved per path from the write's own
 *    actionWait and exclusion category (write-policy.ts confirmWindow), because
 *    a conntrack restart lands in milliseconds and a reboot does not.
 */
import {
  buildWriteRequest,
  redactBuiltWrite,
  REDACTED_VALUE,
  submitBuiltWrite,
  verifyNvram,
  type BuiltWriteRequest,
  type SubmitResult,
  type VerifyProgressEvent,
  type VerifyResult,
  type WriteSpec,
} from './router-io';
import { confirmWindow, hardExclusionReason, isHardExcludedWriteCategory } from './write-policy';
import { log } from './log';

export interface WriteLogEntry {
  id: number;
  timestamp: number;
  /**
   * The REDACTED view of the request (redactBuiltWrite): sensitive field
   * values are replaced with a placeholder before this entry exists, so the
   * in-memory log, the diagnostics inspector, and anything else that renders
   * an entry can never surface a secret. The real body lives only inside the
   * guardedWrite call frame for the duration of the submit.
   */
  request: BuiltWriteRequest;
  /** false when read-only mode or a hard exclusion intercepted the write. */
  submitted: boolean;
  /** Set when a hard-excluded category refused the write outright. */
  blockedReason?: string;
  result?: SubmitResult;
  verify?: VerifyResult;
  error?: string;
}

export interface GuardedWriteOutcome {
  entry: WriteLogEntry;
  /** True only when the write was actually sent AND nvram verified it landed. */
  applied: boolean;
  /** True when nothing was sent — read-only mode OR a hard exclusion. */
  dryRun: boolean;
  /**
   * True when the write was refused because its category is hard-excluded.
   * Independent of read-only mode; implies dryRun.
   */
  blocked: boolean;
  /** Operator-facing explanation, set only when blocked. */
  blockedReason?: string;
}

/**
 * Progress events surfaced through a whole guardedWrite() call. 'submitting'
 * fires once, before submitBuiltWrite; every other event is verifyNvram's own
 * VerifyProgressEvent, threaded straight through unchanged. Modeled as a
 * union (rather than a separate callback per phase) so one UI handler can
 * switch on `.phase` for the entire write lifecycle.
 */
export type WriteProgressEvent = { phase: 'submitting' } | VerifyProgressEvent;
export type WriteProgress = (event: WriteProgressEvent) => void;

const writeLog: WriteLogEntry[] = [];
const MAX_LOG = 200;
let nextId = 1;
let readOnly = true;
const listeners = new Set<() => void>();

export function setReadOnlyMode(v: boolean): void {
  readOnly = v;
}

export function isReadOnlyMode(): boolean {
  return readOnly;
}

export function getWriteLog(): readonly WriteLogEntry[] {
  return writeLog;
}

export function onWriteLogChanged(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function pushEntry(entry: WriteLogEntry): void {
  writeLog.unshift(entry);
  if (writeLog.length > MAX_LOG) writeLog.pop();
  listeners.forEach((cb) => cb());
}

/**
 * Construct, (maybe) submit, and verify a write.
 *
 * @param spec        the write to perform
 * @param verifyKeys  nvram key → expected value after the write. Callers must
 *                    supply this for every nvram-backed write; it is the only
 *                    confirmation that counts.
 * @param onProgress  optional observability hook covering the whole submit +
 *                    verify lifecycle; defaults to a no-op so every existing
 *                    call site keeps working unchanged. See WriteProgressEvent.
 */
export async function guardedWrite(
  spec: WriteSpec,
  verifyKeys: Record<string, string> | null,
  onProgress: WriteProgress = () => {},
): Promise<GuardedWriteOutcome> {
  const request = buildWriteRequest(spec);
  // The entry — and through it the write log, the diagnostics inspector, and
  // every console line below — only ever sees the redacted view. `request`
  // (with real secret values) stays confined to this call frame.
  const loggedRequest = redactBuiltWrite(request);
  const entry: WriteLogEntry = {
    id: nextId++,
    timestamp: Date.now(),
    request: loggedRequest,
    submitted: false,
  };

  // Hard exclusion first, and unconditionally: this is NOT gated on readOnly.
  // A write in one of these categories is refused whether the global interlock
  // is armed or not, so disabling read-only mode cannot reach these paths.
  if (isHardExcludedWriteCategory(spec.writeExclusion)) {
    const blockedReason = hardExclusionReason(spec.writeExclusion);
    entry.blockedReason = blockedReason;
    log.warn('hard-excluded write category: refused, not sent', spec.writeExclusion, request.url);
    pushEntry(entry);
    return { entry, applied: false, dryRun: true, blocked: true, blockedReason };
  }

  if (readOnly) {
    log.info('read-only mode: write intercepted, not sent', request.url, loggedRequest.body);
    pushEntry(entry);
    return { entry, applied: false, dryRun: true, blocked: false };
  }

  try {
    onProgress({ phase: 'submitting' });
    log.info('submitting write', request.url, loggedRequest.body);
    entry.result = await submitBuiltWrite(request);
    entry.submitted = true;
    if (verifyKeys && Object.keys(verifyKeys).length > 0) {
      // The confirmation window is per-path, not global: it comes from this
      // write's own actionWait and exclusion category (write-policy.ts). This
      // is timing only — it does not change what was just submitted, and only
      // a matching forced-fresh nvram read can still set `verified`.
      const budget = confirmWindow(spec.writeExclusion, spec.actionWait, spec.confirmTimeoutMs);
      log.info(
        `verifying by forced-fresh nvram re-read: settle ${budget.settleMs}ms, ceiling ${budget.timeoutMs}ms, poll ${budget.intervalMs}ms`,
      );
      const verify = await verifyNvram(verifyKeys, { ...budget, onProgress, redactKeys: spec.sensitiveKeys });
      // Verify detail carries expected/actual VALUES per key — for sensitive
      // keys those are the secrets themselves (e.g. the expected new PSK), so
      // they get the same redaction as the request body before the result is
      // retained. The match booleans and counts are kept: they carry the
      // outcome without carrying the value.
      const sensitive = new Set(spec.sensitiveKeys ?? []);
      entry.verify = sensitive.size
        ? {
            ...verify,
            detail: Object.fromEntries(
              Object.entries(verify.detail).map(([k, d]) => [
                k,
                sensitive.has(k) ? { ...d, expected: REDACTED_VALUE, actual: REDACTED_VALUE } : d,
              ]),
            ),
          }
        : verify;
    }
    pushEntry(entry);
    const applied = entry.verify ? entry.verify.verified : entry.result.ok;
    return { entry, applied, dryRun: false, blocked: false };
  } catch (e) {
    entry.error = e instanceof Error ? e.message : String(e);
    pushEntry(entry);
    log.error('write failed', entry.error);
    return { entry, applied: false, dryRun: false, blocked: false };
  }
}
