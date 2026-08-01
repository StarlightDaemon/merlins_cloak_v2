/**
 * Shared UI primitives for the shadow-mounted app. Plain class-based styling;
 * all classes live in theme/css.ts.
 */
import { type ReactNode, useEffect, useRef, useState } from 'react';
import type { WriteProgressEvent } from '../lib/write-guard';

export function Card({ title, children, badge, note }: { title?: ReactNode; children: ReactNode; badge?: ReactNode; note?: ReactNode }) {
  return (
    <div className="mc-card">
      {title !== undefined && (
        <div className="mc-card__title">
          {title}
          {badge}
        </div>
      )}
      <div className="mc-card__body">
        {children}
        {note && <p className="mc-card__note">{note}</p>}
      </div>
    </div>
  );
}

export function Row({
  label,
  hint,
  error,
  dirty,
  children,
}: {
  label: ReactNode;
  hint?: ReactNode;
  error?: string;
  dirty?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={`mc-row${dirty ? ' is-dirty' : ''}`}>
      <div className="mc-row__label">
        {label}
        {hint && <span className="hint">{hint}</span>}
      </div>
      <div className="mc-row__control">
        {children}
        {error && <span className="mc-row__error">{error}</span>}
      </div>
    </div>
  );
}

export function TextInput({
  value,
  onChange,
  invalid,
  type = 'text',
  width,
  placeholder,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  invalid?: boolean;
  type?: string;
  width?: number;
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <input
      className={`mc-input${invalid ? ' is-invalid' : ''}`}
      style={width ? { width } : undefined}
      type={type}
      value={value}
      placeholder={placeholder}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      spellCheck={false}
      autoComplete="off"
    />
  );
}

/**
 * Clipboard write that works on the router's plain-http origin, where
 * navigator.clipboard (secure-context-only) is unavailable — falls back to
 * a transient textarea + execCommand('copy').
 */
function copyText(text: string): void {
  if (navigator.clipboard?.writeText) {
    void navigator.clipboard.writeText(text);
    return;
  }
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  document.execCommand('copy');
  ta.remove();
}

/**
 * Read-only credential display: masked by default (fixed-width dots — the
 * mask never leaks the value's length) with explicit Reveal and Copy
 * actions. Copy works while masked, so a key can be moved to a client
 * config without ever being shown on screen. An operator-chosen divergence
 * from native, which renders these in the clear (OPEN_LOOPS "On-screen
 * credential display", decided 2026-08-01).
 */
export function SecretValue({ value }: { value: string }) {
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);
  if (!value) return <code>—</code>;
  return (
    <span className="mc-inlinectl">
      <code>{revealed ? value : '••••••••••••'}</code>
      <Button small onClick={() => setRevealed((r) => !r)}>
        {revealed ? 'Hide' : 'Reveal'}
      </Button>
      <Button
        small
        title="Copy the value to the clipboard (works without revealing it)"
        onClick={() => {
          copyText(value);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1500);
        }}
      >
        {copied ? 'Copied ✓' : 'Copy'}
      </Button>
    </span>
  );
}

/** Password input with a Show/Hide toggle; masked on every mount. */
export function RevealableInput({
  value,
  onChange,
  width,
  invalid,
}: {
  value: string;
  onChange: (v: string) => void;
  width?: number;
  invalid?: boolean;
}) {
  const [show, setShow] = useState(false);
  return (
    <span className="mc-inlinectl">
      <TextInput value={value} onChange={onChange} type={show ? 'text' : 'password'} width={width} invalid={invalid} />
      <Button small onClick={() => setShow((s) => !s)}>
        {show ? 'Hide' : 'Show'}
      </Button>
    </span>
  );
}

export function Select({
  value,
  onChange,
  options,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  disabled?: boolean;
}) {
  const known = options.some((o) => o.value === value);
  return (
    <select className="mc-select" value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)}>
      {!known && value !== '' && <option value={value}>{`(current: ${value})`}</option>}
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function RadioGroup({
  value,
  onChange,
  options,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  disabled?: boolean;
}) {
  return (
    <span className="mc-radio-group">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          disabled={disabled}
          className={o.value === value ? 'is-on' : ''}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </span>
  );
}

export function Toggle({ on, onChange, disabled }: { on: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={disabled}
      className={`mc-toggle${on ? ' is-on' : ''}`}
      onClick={() => onChange(!on)}
    />
  );
}

export function Button({
  children,
  onClick,
  variant,
  disabled,
  small,
  title,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'danger';
  disabled?: boolean;
  small?: boolean;
  title?: string;
}) {
  const cls = ['mc-btn'];
  if (variant === 'primary') cls.push('mc-btn--primary');
  if (variant === 'danger') cls.push('mc-btn--danger');
  if (small) cls.push('mc-btn--sm');
  return (
    <button type="button" className={cls.join(' ')} onClick={onClick} disabled={disabled} title={title}>
      {children}
    </button>
  );
}

export function Badge({ children, tone }: { children: ReactNode; tone?: 'ok' | 'warn' | 'err' | 'info' | 'wired' | '24' | '5' | '6' }) {
  return <span className={`mc-badge${tone ? ` mc-badge--${tone}` : ''}`}>{children}</span>;
}

export function Banner({ children, tone }: { children: ReactNode; tone?: 'warn' | 'err' | 'info' }) {
  return <div className={`mc-banner${tone ? ` mc-banner--${tone}` : ''}`}>{children}</div>;
}

export function Tabs({
  tabs,
  active,
  onSelect,
}: {
  tabs: { id: string; label: ReactNode }[];
  active: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="mc-tabs">
      {tabs.map((t) => (
        <button key={t.id} type="button" className={t.id === active ? 'is-active' : ''} onClick={() => onSelect(t.id)}>
          {t.label}
        </button>
      ))}
    </div>
  );
}

export function Loading({ label = 'Reading from router…' }: { label?: string }) {
  return (
    <div className="mc-loading">
      <span className="mc-spinner" />
      {label}
    </div>
  );
}

/**
 * Live state for the apply-in-flight indicator, derived from the stream of
 * WriteProgressEvent (write-guard.ts) a caller accumulates in its own
 * useState via applyProgressReducer. Deliberately mechanical rather than a
 * generic spinner: every phase after 'submitting' carries the concrete
 * numbers (elapsed/ceiling, attempt count) an advanced operator asked for,
 * and the progress bar tracks them directly instead of just animating.
 */
export interface ApplyProgressState {
  phase: 'submitting' | 'settling' | 'verifying' | 'verified' | 'timeout' | 'failed';
  /** Total settle (action_wait) budget in ms, once known. */
  settleMs: number;
  /** Total verify ceiling in ms (settle included), once known. */
  timeoutMs: number;
  /** Last poll-attempt number seen (0 before the first one). */
  attempt: number;
  /** Last read error seen mid-window, if any — reporting only. */
  lastError?: string;
  /** Set only in the 'failed' phase (submit itself threw). */
  errorMessage?: string;
  /**
   * Date.now() anchor for the current phase's elapsed-time display. Carried
   * forward from 'settling' into 'verifying' so the on-screen elapsed count
   * stays continuous across that transition, matching verifyNvram's own
   * elapsedMs (which is measured from entry, settle included).
   */
  startedAt: number;
}

/**
 * Pure reducer folding one WriteProgressEvent into the previous
 * ApplyProgressState. Exported so any apply flow (not just SettingsPage) can
 * drive the same accumulation from guardedWrite's onProgress callback.
 */
export function applyProgressReducer(
  prev: ApplyProgressState | null,
  event: WriteProgressEvent,
): ApplyProgressState {
  const now = Date.now();
  switch (event.phase) {
    case 'submitting':
      return { phase: 'submitting', settleMs: 0, timeoutMs: 0, attempt: 0, startedAt: now };
    case 'settle-start':
      // A zero-length settle (no actionWait for this path) isn't worth its
      // own visible phase — the very next poll-attempt event supersedes it
      // immediately anyway, so skip straight to keeping the prior state.
      if (event.settleMs <= 0) return prev ?? { phase: 'submitting', settleMs: 0, timeoutMs: 0, attempt: 0, startedAt: now };
      return { phase: 'settling', settleMs: event.settleMs, timeoutMs: prev?.timeoutMs ?? 0, attempt: 0, startedAt: now };
    case 'poll-attempt':
      return {
        phase: 'verifying',
        settleMs: prev?.settleMs ?? 0,
        timeoutMs: event.timeoutMs,
        attempt: event.attempt,
        lastError: event.error,
        startedAt: prev?.startedAt ?? now,
      };
    case 'complete':
      return {
        phase: event.result.verified ? 'verified' : 'timeout',
        settleMs: prev?.settleMs ?? event.result.settleMs,
        timeoutMs: event.result.timeoutMs,
        attempt: event.result.attempts,
        lastError: event.result.lastError,
        startedAt: prev?.startedAt ?? now,
      };
  }
}

function fmtSeconds(ms: number): string {
  return (ms / 1000).toFixed(1);
}

/**
 * The apply-in-flight indicator itself: a phase label plus a real progress
 * bar keyed to elapsed/ceiling (settle countdown while settling, nvram
 * confirmation window while verifying) — never an indeterminate spinner.
 * Ticks its own clock while a phase is time-bounded so the bar visibly moves
 * between the (comparatively sparse) poll-attempt events.
 */
export function ApplyProgress({ state }: { state: ApplyProgressState }) {
  const [now, setNow] = useState(() => Date.now());
  const ticking = state.phase === 'settling' || state.phase === 'verifying';
  useEffect(() => {
    if (!ticking) return;
    const t = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(t);
  }, [ticking]);

  let label: string;
  let pct: number | null = null;
  switch (state.phase) {
    case 'submitting':
      label = 'Submitting write…';
      break;
    case 'settling': {
      // Clamped at 0: `now` (this component's own tick clock) and
      // `state.startedAt` (stamped by applyProgressReducer on the
      // 'settle-start' event) are two independent Date.now() calls a
      // React tick apart, so elapsed can land a hair negative right on the
      // first render — never worth surfacing as "-0.0s".
      const elapsed = Math.max(0, Math.min(now - state.startedAt, state.settleMs));
      label = `Settling (action_wait): ${fmtSeconds(elapsed)}s / ${fmtSeconds(state.settleMs)}s`;
      pct = state.settleMs > 0 ? (elapsed / state.settleMs) * 100 : 100;
      break;
    }
    case 'verifying': {
      const elapsed = Math.max(0, Math.min(now - state.startedAt, state.timeoutMs));
      label = `Verifying: nvram re-read attempt ${state.attempt}, elapsed ${fmtSeconds(elapsed)}s / ${fmtSeconds(state.timeoutMs)}s`;
      pct = state.timeoutMs > 0 ? (elapsed / state.timeoutMs) * 100 : 100;
      break;
    }
    case 'verified':
      label = 'Verified';
      pct = 100;
      break;
    case 'timeout':
      label = 'Timed out — nvram did not confirm within the window';
      pct = 100;
      break;
    case 'failed':
      label = `Write failed: ${state.errorMessage ?? 'unknown error'}`;
      pct = 100;
      break;
  }

  return (
    <div className={`mc-writeprogress mc-writeprogress--${state.phase}`}>
      <div className="mc-writeprogress__label">{label}</div>
      {pct !== null && (
        <div className="mc-writeprogress__track">
          <div className="mc-writeprogress__fill" style={{ width: `${Math.min(100, Math.max(0, pct))}%` }} />
        </div>
      )}
      {state.phase === 'verifying' && state.lastError && (
        <div className="mc-writeprogress__note">last read error: {state.lastError}</div>
      )}
    </div>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <div className="mc-empty">{children}</div>;
}

export function Modal({
  title,
  children,
  footer,
  onClose,
}: {
  title: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  onClose: () => void;
}) {
  const backdropRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div
      className="mc-modal-backdrop"
      ref={backdropRef}
      onMouseDown={(e) => {
        if (e.target === backdropRef.current) onClose();
      }}
    >
      <div className="mc-modal">
        <div className="mc-modal__title">{title}</div>
        <div className="mc-modal__body">{children}</div>
        {footer && <div className="mc-modal__footer">{footer}</div>}
      </div>
    </div>
  );
}
