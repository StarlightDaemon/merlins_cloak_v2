/**
 * Shared UI primitives for the shadow-mounted app. Plain class-based styling;
 * all classes live in theme/css.ts.
 */
import { type ReactNode, useEffect, useRef } from 'react';

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
