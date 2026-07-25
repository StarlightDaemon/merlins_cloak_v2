/**
 * Table editor for nvram rule-list fields ('<'-record / '>'-field encoding,
 * lib/rulelist.ts). Bound to the raw joined string: parses on render,
 * serializes on every edit, so dirty-tracking and write construction in
 * SettingsPage see an ordinary string-valued field.
 */
import { useMemo, useState } from 'react';
import { parseRuleList, serializeRuleList } from '../lib/rulelist';
import type { ListColumn, ListSpec } from '../pages/types';
import { Button } from './components';

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

  const commit = (next: string[][]) => onChange(serializeRuleList(next, spec));

  const setCell = (ri: number, ci: number, v: string) => {
    const next = rows.map((r) => [...r]);
    next[ri][ci] = v;
    commit(next);
  };

  const addDraft = () => setDraft(spec.columns.map((c) => (c.control === 'select' ? (c.options?.[0]?.value ?? '') : '')));

  const commitDraft = () => {
    if (!draft) return;
    commit([...rows, draft]);
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
                <td key={col.id}>{cellControl(col, row[ci] ?? '', (nv) => setCell(ri, ci, nv))}</td>
              ))}
              <td>
                <button
                  type="button"
                  className="mc-listedit__del"
                  title="Remove entry"
                  disabled={disabled}
                  onClick={() => commit(rows.filter((_, i) => i !== ri))}
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
