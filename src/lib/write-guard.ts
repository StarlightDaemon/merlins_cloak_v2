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
 *    does.
 */
import {
  buildWriteRequest,
  submitBuiltWrite,
  verifyNvram,
  type BuiltWriteRequest,
  type SubmitResult,
  type VerifyResult,
  type WriteSpec,
} from './router-io';
import { hardExclusionReason, isHardExcludedWriteCategory } from './write-policy';
import { log } from './log';

export interface WriteLogEntry {
  id: number;
  timestamp: number;
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
 */
export async function guardedWrite(
  spec: WriteSpec,
  verifyKeys: Record<string, string> | null,
): Promise<GuardedWriteOutcome> {
  const request = buildWriteRequest(spec);
  const entry: WriteLogEntry = {
    id: nextId++,
    timestamp: Date.now(),
    request,
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
    log.info('read-only mode: write intercepted, not sent', request.url, request.body);
    pushEntry(entry);
    return { entry, applied: false, dryRun: true, blocked: false };
  }

  try {
    log.info('submitting write', request.url, request.body);
    entry.result = await submitBuiltWrite(request);
    entry.submitted = true;
    if (verifyKeys && Object.keys(verifyKeys).length > 0) {
      entry.verify = await verifyNvram(verifyKeys);
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
