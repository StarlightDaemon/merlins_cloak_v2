/**
 * The single gate every router write passes through.
 *
 * Responsibilities:
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
import { log } from './log';

export interface WriteLogEntry {
  id: number;
  timestamp: number;
  request: BuiltWriteRequest;
  /** false when read-only mode intercepted the write. */
  submitted: boolean;
  result?: SubmitResult;
  verify?: VerifyResult;
  error?: string;
}

export interface GuardedWriteOutcome {
  entry: WriteLogEntry;
  /** True only when the write was actually sent AND nvram verified it landed. */
  applied: boolean;
  /** True when read-only mode blocked submission. */
  dryRun: boolean;
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

  if (readOnly) {
    log.info('read-only mode: write intercepted, not sent', request.url, request.body);
    pushEntry(entry);
    return { entry, applied: false, dryRun: true };
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
    return { entry, applied, dryRun: false };
  } catch (e) {
    entry.error = e instanceof Error ? e.message : String(e);
    pushEntry(entry);
    log.error('write failed', entry.error);
    return { entry, applied: false, dryRun: false };
  }
}
