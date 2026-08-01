/**
 * Table editor for nvram rule-list fields ('<'-record / '>'-field encoding,
 * lib/rulelist.ts). Bound to the raw joined string: parses on render,
 * serializes on every edit, so dirty-tracking and write construction in
 * SettingsPage see an ordinary string-valued field.
 */
import { useMemo, useRef, useState } from 'react';
import { parseRuleList, serializeRuleList } from '../lib/rulelist';
import type { ListColumn, ListSpec } from '../pages/types';
import { Button } from './components';

/**
 * Cell for a `secret` column (account passwords, keys): masked password
 * input with a per-cell Show/Hide toggle — an operator-chosen divergence
 * from native, which renders these columns in the clear (see
 * ListColumn.secret). Validation, storage, and writes are unchanged.
 */
function SecretCell({
  col,
  value,
  set,
  disabled,
}: {
  col: ListColumn;
  value: string;
  set: (nv: string) => void;
  disabled?: boolean;
}) {
  const [show, setShow] = useState(false);
  return (
    <span className="mc-inlinectl">
      <input
        className={`mc-input${validateCell(col, value) ? ' is-invalid' : ''}${col.mono ? ' mc-input--mono' : ''}`}
        type={show ? 'text' : 'password'}
        value={value}
        placeholder={col.placeholder}
        disabled={disabled}
        spellCheck={false}
        autoComplete="off"
        onChange={(e) => set(e.target.value)}
      />
      <Button small onClick={() => setShow((s) => !s)}>
        {show ? 'Hide' : 'Show'}
      </Button>
    </span>
  );
}

function validateCell(col: ListColumn, value: string): string | null {
  const v = col.validate;
  if (!v) return null;
  if (v.required && value.trim() === '') return `${col.label} is required`;
  if (value === '') return null;
  if (v.min !== undefined || v.max !== undefined) {
    const n = Number(value);
    if (Number.isNaN(n)) return `${col.label} must be a number`;
    if (v.min !== undefined && n < v.min) return `${col.label}: minimum ${v.min}`;
    if (v.max !== undefined && n > v.max) return `${col.label}: maximum ${v.max}`;
  }
  if (v.maxLength !== undefined && value.length > v.maxLength) return `${col.label}: max ${v.maxLength} chars`;
  if (v.pattern && !new RegExp(v.pattern).test(value)) return v.patternHint ?? `${col.label}: invalid format`;
  return null;
}

/** First validation error across all rows/cells, or null. */
export function validateRuleList(raw: string, spec: ListSpec): string | null {
  const rows = parseRuleList(raw, spec);
  if (spec.maxRows !== undefined && rows.length > spec.maxRows) return `Maximum ${spec.maxRows} entries`;
  for (const [ri, row] of rows.entries()) {
    for (const [ci, col] of spec.columns.entries()) {
      const err = validateCell(col, row[ci] ?? '');
      if (err) return `Row ${ri + 1}: ${err}`;
    }
  }
  return null;
}

export function ListEditor({
  spec,
  value,
  onChange,
  disabled,
}: {
  spec: ListSpec;
  value: string;
  onChange: (raw: string) => void;
  disabled?: boolean;
}) {
  const rows = useMemo(() => parseRuleList(value, spec), [value, spec]);
  // Draft row under construction, not yet part of the serialized value.
  const [draft, setDraft] = useState<string[] | null>(null);

  // Latest committed raw value, updated synchronously by commit() below.
  // Mutating handlers (cell edits, row deletes, draft commit) derive their
  // next state from this ref at event time, never from the render-time
  // `rows` snapshot: two handlers firing before an intervening React commit
  // (e.g. rapid back-to-back deletes) would otherwise both compute against
  // the same stale snapshot and the second would overwrite the first.
  const valueRef = useRef(value);
  valueRef.current = value; // re-synced every render so external updates win

  const latestRows = () => parseRuleList(valueRef.current, spec);

  const sameRow = (a: string[], b: string[]) => a.length === b.length && a.every((x, i) => x === b[i]);

  /**
   * Index in `latest` of the row rendered at index `ri` with content `row`,
   * or -1 if it no longer exists. Prefers the original index while content
   * still matches there, so duplicate rows resolve to the one clicked;
   * otherwise falls back to content identity (indices shift when an earlier
   * same-tick operation removed a preceding row).
   */
  const locateRow = (latest: string[][], row: string[], ri: number) =>
    latest[ri] && sameRow(latest[ri], row) ? ri : latest.findIndex((r) => sameRow(r, row));

  const commit = (next: string[][]) => {
    const raw = serializeRuleList(next, spec);
    valueRef.current = raw;
    onChange(raw);
  };

  const setCell = (row: string[], ri: number, ci: number, v: string) => {
    const latest = latestRows();
    const at = locateRow(latest, row, ri);
    if (at === -1) return; // row vanished under us (e.g. deleted this tick)
    const next = latest.map((r) => [...r]);
    next[at][ci] = v;
    commit(next);
  };

  const deleteRow = (row: string[], ri: number) => {
    const latest = latestRows();
    const at = locateRow(latest, row, ri);
    if (at !== -1) commit(latest.filter((_, i) => i !== at));
  };

  const addDraft = () => setDraft(spec.columns.map((c) => (c.control === 'select' ? (c.options?.[0]?.value ?? '') : '')));

  const commitDraft = () => {
    if (!draft) return;
    commit([...latestRows(), draft]);
    setDraft(null);
  };

  const draftError = draft
    ? spec.columns.map((c, i) => validateCell(c, draft[i] ?? '')).find((e) => e !== null) ?? null
    : null;
  const atCap = spec.maxRows !== undefined && rows.length >= spec.maxRows;

  const cellControl = (col: ListColumn, v: string, set: (nv: string) => void) => {
    if (col.control === 'select') {
      const known = (col.options ?? []).some((o) => o.value === v);
      return (
        <select className="mc-select" value={v} disabled={disabled} onChange={(e) => set(e.target.value)}>
          {!known && v !== '' && <option value={v}>{`(${v})`}</option>}
          {(col.options ?? []).map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      );
    }
    if (col.secret) {
      return <SecretCell col={col} value={v} set={set} disabled={disabled} />;
    }
    return (
      <input
        className={`mc-input${validateCell(col, v) ? ' is-invalid' : ''}${col.mono ? ' mc-input--mono' : ''}`}
        value={v}
        placeholder={col.placeholder}
        disabled={disabled}
        spellCheck={false}
        autoComplete="off"
        onChange={(e) => set(e.target.value)}
      />
    );
  };

  return (
    <div className="mc-listedit">
      <table className="mc-table">
        <thead>
          <tr>
            {spec.columns.map((c) => (
              <th key={c.id} style={c.width ? { width: c.width } : undefined}>
                {c.label}
              </th>
            ))}
            <th style={{ width: 40 }} />
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && !draft && (
            <tr>
              <td colSpan={spec.columns.length + 1} className="mc-listedit__empty">
                No entries
              </td>
            </tr>
          )}
          {rows.map((row, ri) => (
            <tr key={ri}>
              {spec.columns.map((col, ci) => (
                <td key={col.id}>{cellControl(col, row[ci] ?? '', (nv) => setCell(row, ri, ci, nv))}</td>
              ))}
              <td>
                <button
                  type="button"
                  className="mc-listedit__del"
                  title="Remove entry"
                  disabled={disabled}
                  onClick={() => deleteRow(row, ri)}
                >
                  ✕
                </button>
              </td>
            </tr>
          ))}
          {draft && (
            <tr className="mc-listedit__draft">
              {spec.columns.map((col, ci) => (
                <td key={col.id}>
                  {cellControl(col, draft[ci] ?? '', (nv) =>
                    setDraft((d) => (d ? d.map((x, i) => (i === ci ? nv : x)) : d)),
                  )}
                </td>
              ))}
              <td>
                <button type="button" className="mc-listedit__del" title="Discard" onClick={() => setDraft(null)}>
                  ✕
                </button>
              </td>
            </tr>
          )}
        </tbody>
      </table>
      <div className="mc-listedit__bar">
        {draft ? (
          <Button small variant="primary" onClick={commitDraft} disabled={disabled || draftError !== null}>
            Add entry
          </Button>
        ) : (
          <Button small onClick={addDraft} disabled={disabled || atCap} title={atCap ? `Maximum ${spec.maxRows} entries` : undefined}>
            {spec.addLabel ?? '+ Add'}
          </Button>
        )}
        {draft && draftError && <span className="mc-row__error">{draftError}</span>}
        <span className="mc-listedit__count">
          {rows.length}
          {spec.maxRows !== undefined ? ` / ${spec.maxRows}` : ''} entr{rows.length === 1 ? 'y' : 'ies'}
        </span>
      </div>
    </div>
  );
}
