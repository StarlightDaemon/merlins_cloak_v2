/**
 * Generic renderer for declarative SettingsPageDef pages.
 *
 * Read: nvram/nvramAscii/hook reads per the page def, forced-fresh.
 * Edit: local dirty-tracking against the baseline.
 * Apply: validation → WriteSpec construction → write-guard. In read-only mode
 * the guard intercepts and this renderer shows the exact request that would
 * have been sent. After a real submit, the poll-and-verify result is shown —
 * the DOM is never trusted, the response body is never trusted.
 *
 * Instance pages (def.instance): all state is keyed by TEMPLATE keys
 * (containing '{p}'); the selected instance value is substituted only when
 * building read requests and write payloads. Switching instances reloads.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Capabilities } from '../lib/capabilities';
import { nvramCharToAscii, nvramGet, appGet, type WriteSpec } from '../lib/router-io';
import { guardedWrite, isReadOnlyMode, type GuardedWriteOutcome, type WriteProgressEvent } from '../lib/write-guard';
import { hardExclusionReason, isHardExcludedWriteCategory } from '../lib/write-policy';
import type { FieldDef, SettingsPageDef } from '../pages/types';
import {
  ApplyProgress,
  applyProgressReducer,
  type ApplyProgressState,
  Badge,
  Banner,
  Button,
  Card,
  Loading,
  Modal,
  RadioGroup,
  Row,
  Select,
  TextInput,
  Toggle,
} from './components';
import { ListEditor, validateRuleList } from './ListEditor';

function validateField(f: FieldDef, value: string, emptyIntended = false): string | null {
  if (f.control === 'list' && f.list) return validateRuleList(value, f.list);
  const v = f.validate;
  if (!v) return null;
  // An empty value that is the field's INTENDED state — explicitly cleared
  // via the Clear action, or pristine-unset (baseline empty and the value
  // still equal to it) — is valid as-is: the firmware accepts empty for
  // every plain nvram field (web.c:4750 nvram_set(tmp, "")), so
  // required/min/pattern describe non-empty *input*, not an obligation to
  // configure the feature. Backspacing a required field to empty without
  // the Clear action still errors — that is how "empty because clearing"
  // stays distinguishable from "empty because incomplete".
  if (emptyIntended && value.trim() === '') return null;
  if (v.required && value.trim() === '') return 'Required';
  if (v.min !== undefined || v.max !== undefined) {
    const n = Number(value);
    if (Number.isNaN(n)) return 'Must be a number';
    if (v.min !== undefined && n < v.min) return `Minimum ${v.min}`;
    if (v.max !== undefined && n > v.max) return `Maximum ${v.max}`;
  }
  if (v.maxLength !== undefined && value.length > v.maxLength) return `Maximum ${v.maxLength} characters`;
  if (v.pattern && value !== '' && !new RegExp(v.pattern).test(value)) return v.patternHint ?? 'Invalid format';
  return null;
}

function FieldControl({
  field,
  value,
  onChange,
  caps,
  emptyOk,
}: {
  field: FieldDef;
  value: string;
  onChange: (v: string) => void;
  caps: Capabilities;
  /** Empty is this field's intended state (cleared / pristine-unset) — suppress invalid styling for it. */
  emptyOk?: boolean;
}) {
  switch (field.control) {
    case 'toggle': {
      const on = field.invert ? value === '0' : value === '1';
      return <Toggle on={on} onChange={(next) => onChange(field.invert ? (next ? '0' : '1') : next ? '1' : '0')} />;
    }
    case 'radio':
      return (
        <RadioGroup
          value={value}
          onChange={onChange}
          options={(field.options ?? []).filter((o) => !o.gate || o.gate(caps))}
        />
      );
    case 'select':
      return (
        <Select
          value={value}
          onChange={onChange}
          options={(field.options ?? []).filter((o) => !o.gate || o.gate(caps))}
        />
      );
    case 'textarea':
      return (
        <textarea className="mc-textarea" value={value} spellCheck={false} onChange={(e) => onChange(e.target.value)} />
      );
    case 'readonly':
      return <code>{value || '—'}</code>;
    case 'number':
      return <TextInput value={value} onChange={onChange} width={140} invalid={validateField(field, value, emptyOk) !== null} />;
    case 'password':
      return <TextInput value={value} onChange={onChange} type="password" width={260} />;
    case 'list':
      return field.list ? <ListEditor spec={field.list} value={value} onChange={onChange} /> : null;
    default:
      return <TextInput value={value} onChange={onChange} width={260} invalid={validateField(field, value, emptyOk) !== null} />;
  }
}

export function SettingsPage({ def, caps }: { def: SettingsPageDef; caps: Capabilities }) {
  const [baseline, setBaseline] = useState<Record<string, string> | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [applyProgress, setApplyProgress] = useState<ApplyProgressState | null>(null);
  const [outcome, setOutcome] = useState<GuardedWriteOutcome | null>(null);
  const [eulaAccepted, setEulaAccepted] = useState<boolean | null>(null);
  /**
   * Keys the operator explicitly set to empty via the field's Clear action.
   * Marks "empty because clearing" (a real write of an explicit empty value,
   * exempt from required validation) as distinct from "empty because
   * incomplete input" (still an error). Typing in a field un-marks it;
   * Revert and every reload reset the whole set.
   */
  const [cleared, setCleared] = useState<Set<string>>(() => new Set());

  const instanceOptions = useMemo(
    () => (def.instance ? def.instance.options.filter((o) => !o.gate || o.gate(caps)) : []),
    [def, caps],
  );
  const [instance, setInstance] = useState<string | undefined>(instanceOptions[0]?.value);

  /** '{p}' → selected instance value, at the I/O boundary only. */
  const expand = useCallback(
    (key: string) => (instance !== undefined ? key.replaceAll('{p}', instance) : key),
    [instance],
  );

  // Supersedure guard: each load() call takes a generation number; responses
  // belonging to a superseded call (an instance switch, or any newer load)
  // are discarded instead of overwriting the newer load's state.
  const loadGen = useRef(0);

  const load = useCallback(async () => {
    const gen = ++loadGen.current;
    setLoadError(null);
    setBaseline(null);
    try {
      const readMapped = async (
        keys: string[] | undefined,
        reader: (k: string[]) => Promise<Record<string, string>>,
      ): Promise<Record<string, string>> => {
        if (!keys?.length) return {};
        const expanded = await reader(keys.map(expand));
        const out: Record<string, string> = {};
        for (const k of keys) out[k] = expanded[expand(k)] ?? '';
        return out;
      };
      const plain = await readMapped(def.read.nvram, nvramGet);
      const ascii = await readMapped(def.read.nvramAscii, nvramCharToAscii);
      const hooks = def.read.hooks?.length ? await appGet(def.read.hooks.map(expand)) : {};
      let merged: Record<string, string> = { ...plain, ...ascii };
      for (const [k, v] of Object.entries(hooks)) {
        if (!(k in merged)) merged[k] = typeof v === 'string' ? v : JSON.stringify(v);
      }
      if (def.read.derive) merged = { ...merged, ...def.read.derive(merged, instance) };
      let eula: boolean | null = null;
      if (def.eulaGate) {
        const eulaVals = await nvramGet(def.eulaGate.nvramKeys);
        // TM_EULA is versioned: 1 = accepted, 2 = accepted newer text. Any
        // non-zero value counts as accepted.
        eula = Object.values(eulaVals).some((v) => v !== '' && v !== '0');
      }
      if (gen !== loadGen.current) return; // superseded by a newer load
      if (eula !== null) setEulaAccepted(eula);
      setBaseline(merged);
      setValues(merged);
      setCleared(new Set());
    } catch (e) {
      if (gen !== loadGen.current) return; // superseded by a newer load
      setLoadError(e instanceof Error ? e.message : String(e));
    }
  }, [def, expand, instance]);

  useEffect(() => {
    void load();
  }, [load]);

  const allFields = useMemo(() => def.sections.flatMap((s) => s.fields), [def]);

  const dirty = useMemo(() => {
    if (!baseline) return {};
    const d: Record<string, string> = {};
    for (const f of allFields) {
      if (values[f.key] !== undefined && values[f.key] !== baseline[f.key]) d[f.key] = values[f.key];
    }
    return d;
  }, [values, baseline, allFields]);

  /** Empty is this field's intended state: explicitly cleared, or pristine-unset (see validateField). */
  const emptyIntended = useCallback(
    (key: string) => cleared.has(key) || ((baseline?.[key] ?? '') === '' && (values[key] ?? '') === ''),
    [cleared, baseline, values],
  );

  const errors = useMemo(() => {
    const errs: Record<string, string> = {};
    for (const f of allFields) {
      if (f.showIf && !f.showIf(values, caps)) continue;
      const err = validateField(f, values[f.key] ?? '', emptyIntended(f.key));
      if (err) errs[f.key] = err;
    }
    return errs;
  }, [values, allFields, caps, emptyIntended]);

  /** User edit: set the value and un-mark any explicit clear — typed input validates normally again. */
  const setFieldValue = useCallback((key: string, v: string) => {
    setValues((s) => ({ ...s, [key]: v }));
    setCleared((s) => {
      if (!s.has(key)) return s;
      const next = new Set(s);
      next.delete(key);
      return next;
    });
  }, []);

  /** Clear action: an explicit empty value becomes the field's intended state. */
  const clearField = useCallback((key: string) => {
    setValues((s) => ({ ...s, [key]: '' }));
    setCleared((s) => new Set(s).add(key));
  }, []);

  const dirtyCount = Object.keys(dirty).length;
  const hasErrors = Object.keys(errors).length > 0;
  /** Non-null only for the categories the write guard refuses outright. */
  const hardExcluded = isHardExcludedWriteCategory(def.writeExclusion) ? def.writeExclusion : null;

  const onWriteProgress = useCallback((event: WriteProgressEvent) => {
    setApplyProgress((prev) => applyProgressReducer(prev, event));
  }, []);

  const apply = useCallback(async () => {
    if (!def.write || !baseline || dirtyCount === 0) return;
    setBusy(true);
    setApplyProgress(null);
    try {
      const fields = def.write.buildFields ? def.write.buildFields(dirty, values) : { ...dirty };
      const fullSet = Object.fromEntries(allFields.map((f) => [f.key, values[f.key] ?? '']));
      const templateFields =
        def.write.endpoint === 'start_apply'
          ? // whole-page semantics: current value of EVERY field, changes on top
            { ...fullSet, ...fields }
          : fields;
      const expandRecord = (rec: Record<string, string>) =>
        Object.fromEntries(Object.entries(rec).map(([k, v]) => [expand(k), v]));
      // rcService may be a fixed string or a direction-dependent resolver
      // (see WriteDef.rcService in pages/types.ts) — resolved once here,
      // against the same (dirty, values) pair buildFields/buildVerify see.
      const rcServiceValue =
        typeof def.write.rcService === 'function' ? def.write.rcService(dirty, values) : def.write.rcService;
      // Secret-bearing keys, for log/inspector redaction only (never affects
      // what is submitted): every `control: 'password'` field's key
      // automatically, plus any composite carriers the def names explicitly
      // (WriteDef.sensitiveKeys — serialized lists and joined strings a
      // control type can't mark). Template keys expand the same way the
      // posted fields do. Extra names that don't occur in this particular
      // delta are harmless — redaction is a lookup, not a validation.
      const sensitiveKeys = [
        ...allFields.filter((f) => f.control === 'password').map((f) => f.key),
        ...(def.write.sensitiveKeys ?? []),
      ].map(expand);
      const spec: WriteSpec = {
        endpoint: def.write.endpoint,
        // Threaded through so the guard can enforce it. The UI below also
        // refuses to offer Apply, but the guard is the enforcement point —
        // this is not a UI-only control.
        writeExclusion: def.writeExclusion ?? null,
        fields: expandRecord(templateFields),
        rcService: rcServiceValue ? expand(rcServiceValue) : undefined,
        actionWait: def.write.actionWait,
        confirmTimeoutMs: def.write.confirmTimeoutMs,
        currentPage: def.aspPage,
        nextPage: def.aspPage,
        sensitiveKeys: sensitiveKeys.length ? sensitiveKeys : undefined,
      };
      const verify = def.write.buildVerify ? def.write.buildVerify(dirty, values) : { ...dirty };
      const result = await guardedWrite(spec, verify ? expandRecord(verify) : null, onWriteProgress);
      // The write chokepoint swallows submit-time failures rather than
      // throwing (entry.error) — verifyNvram never runs in that case, so no
      // 'complete' progress event covers it. Surface it explicitly here so
      // the progress indicator doesn't just stall on 'Submitting…'.
      if (result.entry.error) {
        setApplyProgress((prev) => ({
          phase: 'failed',
          settleMs: prev?.settleMs ?? 0,
          timeoutMs: prev?.timeoutMs ?? 0,
          attempt: prev?.attempt ?? 0,
          errorMessage: result.entry.error,
          startedAt: prev?.startedAt ?? Date.now(),
        }));
      }
      setOutcome(result);
      if (result.applied) {
        await load();
      }
    } finally {
      setBusy(false);
    }
  }, [def, baseline, dirty, values, allFields, dirtyCount, load, expand, onWriteProgress]);

  if (loadError) {
    return (
      <Banner tone="err">
        Failed to read this page's settings from the router: {loadError}{' '}
        <Button small onClick={() => void load()}>
          Retry
        </Button>
      </Banner>
    );
  }

  const instanceBar = def.instance && instanceOptions.length > 0 && (
    <div className="mc-instancebar">
      <span className="mc-instancebar__label">{def.instance.label}</span>
      <RadioGroup
        value={instance ?? ''}
        onChange={(v) => {
          if (dirtyCount > 0 && !window.confirm('Discard unsaved changes on this page?')) return;
          setInstance(v);
        }}
        options={instanceOptions.map(({ value, label }) => ({ value, label }))}
        disabled={busy}
      />
    </div>
  );

  return (
    <div>
      <h1 className="mc-page-title">{def.title}</h1>
      <p className="mc-page-subtitle">
        {def.aspPage}
        {def.merlinOnly ? ' · Merlin' : ''}
      </p>
      {(() => {
        const raw = typeof def.intro === 'function' ? def.intro(instance, caps) : def.intro;
        if (!raw) return null;
        const resolved = typeof raw === 'string' ? { text: raw, tone: 'info' as const } : raw;
        return <Banner tone={resolved.tone ?? 'info'}>{resolved.text}</Banner>;
      })()}
      {def.write && hardExcluded && (
        <Banner tone="err">
          {hardExclusionReason(hardExcluded)} You can read and inspect these settings, but Apply is unavailable on
          this page.
        </Banner>
      )}
      {def.eulaGate && eulaAccepted === false && (
        <Banner tone="warn">
          {def.eulaGate.label} requires EULA acceptance before changes take effect. The router will silently ignore
          writes to this feature until the EULA has been accepted in the native UI, so Apply is disabled here — the
          settings below are effectively read-only until then.
        </Banner>
      )}
      {instanceBar}
      {!baseline ? (
        <Loading />
      ) : (
        <>
          {def.sections.map((section, i) => {
            if (section.showIf && !section.showIf(values, caps)) return null;
            const visible = section.fields.filter((f) => !f.showIf || f.showIf(values, caps));
            if (visible.length === 0) return null;
            return (
              <Card key={i} title={section.title} note={section.note}>
                {visible.map((f) => {
                  // Clear-to-empty affordance: only meaningful on writable
                  // pages, for free-input controls whose required validation
                  // would otherwise make an empty value inexpressible
                  // (operator-surfaced during the D-030 WireGuard revert).
                  const clearable =
                    Boolean(def.write) &&
                    Boolean(f.validate?.required) &&
                    ['text', 'number', 'password', 'textarea'].includes(f.control ?? 'text');
                  const clearBtn = clearable && (
                    <Button
                      small
                      title="Set this field to empty — Apply will write an explicit empty value, clearing the setting on the router"
                      onClick={() => clearField(f.key)}
                      disabled={
                        busy ||
                        ((values[f.key] ?? '') === '' &&
                          (cleared.has(f.key) || (baseline[f.key] ?? '') === ''))
                      }
                    >
                      Clear
                    </Button>
                  );
                  return f.control === 'list' ? (
                    <div key={f.key} className={`mc-row mc-row--stack${dirty[f.key] !== undefined ? ' is-dirty' : ''}`}>
                      <div className="mc-row__label">
                        {f.label}
                        {f.hint && <span className="hint">{f.hint}</span>}
                      </div>
                      <FieldControl
                        field={f}
                        value={values[f.key] ?? ''}
                        onChange={(v) => setFieldValue(f.key, v)}
                        caps={caps}
                      />
                      {errors[f.key] && <span className="mc-row__error">{errors[f.key]}</span>}
                    </div>
                  ) : (
                    <Row
                      key={f.key}
                      label={f.label}
                      hint={f.hint}
                      error={errors[f.key]}
                      dirty={dirty[f.key] !== undefined}
                    >
                      {clearBtn ? (
                        <span className="mc-clearable">
                          <FieldControl
                            field={f}
                            value={values[f.key] ?? ''}
                            onChange={(v) => setFieldValue(f.key, v)}
                            caps={caps}
                            emptyOk={emptyIntended(f.key)}
                          />
                          {clearBtn}
                        </span>
                      ) : (
                        <FieldControl
                          field={f}
                          value={values[f.key] ?? ''}
                          onChange={(v) => setFieldValue(f.key, v)}
                          caps={caps}
                          emptyOk={emptyIntended(f.key)}
                        />
                      )}
                    </Row>
                  );
                })}
              </Card>
            );
          })}

          {def.write && dirtyCount > 0 && !hardExcluded && !(def.eulaGate && eulaAccepted === false) && (
            <div className="mc-applybar">
              <div className="mc-applybar__summary">
                <b>{dirtyCount}</b> pending change{dirtyCount === 1 ? '' : 's'}
                {hasErrors && ' · fix validation errors to apply'}
                {isReadOnlyMode() && ' · read-only mode: Apply will preview the request without sending'}
              </div>
              <Button
                onClick={() => {
                  setValues(baseline);
                  setCleared(new Set());
                }}
                disabled={busy}
              >
                Revert
              </Button>
              <Button variant="primary" onClick={() => void apply()} disabled={busy || hasErrors}>
                {busy ? 'Applying…' : isReadOnlyMode() ? 'Preview Apply' : 'Apply'}
              </Button>
              {busy && applyProgress && <ApplyProgress state={applyProgress} />}
            </div>
          )}
        </>
      )}

      {outcome && (
        <Modal
          title={
            outcome.blocked
              ? 'Write refused (hard-excluded category — nothing was sent)'
              : outcome.dryRun
                ? 'Write preview (read-only mode — nothing was sent)'
                : 'Apply result'
          }
          onClose={() => setOutcome(null)}
          footer={
            <Button variant="primary" onClick={() => setOutcome(null)}>
              Close
            </Button>
          }
        >
          <p>
            <Badge tone={outcome.blocked ? 'err' : outcome.dryRun ? 'info' : outcome.applied ? 'ok' : 'err'}>
              {outcome.blocked ? 'BLOCKED' : outcome.dryRun ? 'DRY RUN' : outcome.applied ? 'VERIFIED APPLIED' : 'NOT CONFIRMED'}
            </Badge>{' '}
            <code>
              POST {outcome.entry.request.url}
            </code>
          </p>
          {outcome.blockedReason && <Banner tone="err">{outcome.blockedReason}</Banner>}
          <pre>{outcome.entry.request.body}</pre>
          {outcome.entry.result && (
            <p>
              Response ({outcome.entry.result.status}): <code>{outcome.entry.result.responseText.slice(0, 300)}</code>
              <br />
              <em>The response body is never trusted as confirmation.</em>
            </p>
          )}
          {outcome.entry.verify && (
            <div>
              <p>
                Live nvram verification ({outcome.entry.verify.attempts} read
                {outcome.entry.verify.attempts === 1 ? '' : 's'}, {outcome.entry.verify.elapsedMs}ms of a{' '}
                {outcome.entry.verify.timeoutMs}ms window
                {outcome.entry.verify.settleMs > 0
                  ? `, after a ${outcome.entry.verify.settleMs}ms wait for this page's own action_wait`
                  : ''}
                ):
              </p>
              {outcome.entry.verify.reads === 0 ? (
                <Banner tone="warn">
                  The router never answered a read inside the confirmation window, so whether this write landed is{' '}
                  <strong>unknown</strong> — not failed. Re-read this page once the router is reachable again.
                  {outcome.entry.verify.lastError ? ` Last read error: ${outcome.entry.verify.lastError}` : ''}
                </Banner>
              ) : (
                <pre>
                  {Object.entries(outcome.entry.verify.detail)
                    .map(([k, d]) => `${d.match ? '✓' : '✗'} ${k} = ${JSON.stringify(d.actual)}${d.match ? '' : ` (expected ${JSON.stringify(d.expected)})`}`)
                    .join('\n')}
                </pre>
              )}
              {outcome.entry.verify.reads > 0 && outcome.entry.verify.lastError && (
                <p>
                  <em>Some reads in the window failed (last: {outcome.entry.verify.lastError}).</em>
                </p>
              )}
            </div>
          )}
          {outcome.entry.error && <Banner tone="err">{outcome.entry.error}</Banner>}
        </Modal>
      )}
    </div>
  );
}
