/**
 * The Fujin theme, materialized. Builds the complete stylesheet injected as a
 * <style> element at the shadow root (external stylesheets and @import do not
 * work inside a shadow root). Tokens come from the real `@fujin/ui` package
 * (git-tag install, see package.json) rather than a hand-copied snapshot —
 * `scalarVars` carries the mode/accent-invariant tokens, `resolveDark('blue')`
 * carries the dark-mode semantic roles under Fujin's `blue` accent preset
 * (chosen to match this extension's existing blue identity; see
 * .raiden/state/DECISIONS.md). This extension is dark-only today — no
 * `resolveLight` call, no mode toggle.
 *
 * `--badge-wired` / `--badge-24` / `--badge-5` / `--badge-6` (the connection-
 * type badges) are a local extension: Fujin's semantic system has no
 * categorical/qualitative role for a 4-way badge like this, so these are
 * pulled from Fujin's raw palette ramps instead of a semantic token.
 *
 * Radius follows Fujin's rule faithfully (0px, no exceptions) everywhere
 * that shape was previously a themeable "roundedness" choice — including the
 * toggle switch and status dot, which is Fujin's own stated precedent (see
 * docs/INTEGRATION_GUIDE.md §10 on Mantine's `Switch`). The one deliberate
 * exception is .mc-spinner's `border-radius: 50%`, kept as a plain literal:
 * it is not a themeable "roundedness" choice, it's a functional requirement
 * of a rotating-ring loading indicator (a sharp-cornered spinner does not
 * read as "loading"), and Fujin's own docs never address it either way.
 */
import { scalarVars, resolveDark, palette } from '@fujin/ui';

const badgeVars: Record<string, string> = {
  '--badge-wired': palette.blue[5],
  '--badge-24': palette.green[5],
  '--badge-5': palette.orange[5],
  '--badge-6': palette.grape[5],
};

const hostVars: Record<string, string> = {
  ...scalarVars,
  ...resolveDark('blue'),
  ...badgeVars,
};

function hostVarsCss(): string {
  return Object.entries(hostVars)
    .map(([name, value]) => `  ${name}: ${value};`)
    .join('\n');
}

export function buildThemeCss(): string {
  return `
:host {
  all: initial;
${hostVarsCss()}
  --shadow: var(--fujin-shadow-lg);
}

/* ---- resets, scoped to the shadow tree ---- */
*, *::before, *::after { box-sizing: border-box; }
.mc-app {
  font-family: var(--fujin-font-family-base);
  font-size: 13px;
  line-height: 1.5;
  color: var(--fujin-text-primary);
  background: var(--fujin-bg-base);
  position: fixed;
  inset: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  z-index: 2147483000;
}
.mc-app a { color: var(--fujin-interactive-default); text-decoration: none; }
.mc-app a:hover { color: var(--fujin-interactive-hover); text-decoration: underline; }
.mc-app code, .mc-app pre { font-family: var(--fujin-font-family-mono); font-size: 12px; }

/* ---- header ---- */
.mc-header {
  height: 52px;
  flex: none;
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 0 18px;
  background: var(--fujin-chrome-bg);
  border-bottom: 1px solid var(--fujin-border-subtle);
}
.mc-header__brand {
  font-weight: bold;
  font-size: 15px;
  letter-spacing: 0.4px;
  white-space: nowrap;
}
.mc-header__brand em { color: var(--fujin-interactive-active); font-style: normal; }
.mc-header__identity {
  color: var(--fujin-text-secondary);
  font-size: 12px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.mc-header__spacer { flex: 1; }
.mc-header__chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 3px 10px;
  border-radius: var(--fujin-radius-default);
  background: var(--fujin-bg-surface);
  border: 1px solid var(--fujin-border-default);
  color: var(--fujin-text-secondary);
  font-size: 11.5px;
  white-space: nowrap;
}
.mc-header__chip .dot { width: 8px; height: 8px; border-radius: var(--fujin-radius-default); background: var(--fujin-text-muted); }
.mc-header__chip.is-ok .dot { background: var(--fujin-status-success); }
.mc-header__chip.is-warn .dot { background: var(--fujin-status-warning); }
.mc-header__chip.is-err .dot { background: var(--fujin-status-danger); }

/* ---- body layout ---- */
.mc-body { flex: 1; display: flex; min-height: 0; }
.mc-nav {
  width: 236px;
  flex: none;
  overflow-y: auto;
  background: var(--fujin-bg-surface);
  border-right: 1px solid var(--fujin-border-subtle);
  padding: 10px 0 24px;
}
.mc-main {
  flex: 1;
  min-width: 0;
  overflow-y: auto;
  padding: 20px 26px 90px;
  scrollbar-color: var(--fujin-interactive-active) var(--fujin-chrome-bg);
}
.mc-main__inner { max-width: 1040px; margin: 0 auto; }

/* ---- nav ---- */
.mc-nav__group { margin-bottom: 2px; }
.mc-nav__group-title {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 8px 16px;
  background: none;
  border: none;
  color: var(--fujin-text-secondary);
  font: inherit;
  font-size: 12.5px;
  font-weight: bold;
  cursor: pointer;
  text-align: left;
}
.mc-nav__group-title:hover { color: var(--fujin-text-primary); }
.mc-nav__group-title .chev { margin-left: auto; font-size: 10px; opacity: 0.7; transition: transform 0.12s; }
.mc-nav__group.is-open .chev { transform: rotate(90deg); }
.mc-nav__sub { margin-bottom: 2px; }
.mc-nav__subheader {
  padding: 7px 16px 2px 28px;
  font-size: 10px;
  font-weight: bold;
  letter-spacing: 0.8px;
  text-transform: uppercase;
  color: var(--fujin-text-muted);
}
.mc-nav__item {
  display: block;
  width: 100%;
  padding: 6px 16px 6px 32px;
  background: none;
  border: none;
  border-left: 3px solid transparent;
  color: var(--fujin-text-secondary);
  font: inherit;
  font-size: 12.5px;
  cursor: pointer;
  text-align: left;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.mc-nav__item:hover { color: var(--fujin-text-primary); background: var(--fujin-bg-elevated); }
.mc-nav__item.is-active {
  color: var(--fujin-text-primary);
  background: var(--fujin-bg-elevated);
  border-left-color: var(--fujin-interactive-active);
}
.mc-prior-tip {
  position: fixed;
  z-index: 2147483001;
  max-width: 260px;
  padding: 3px 9px;
  background: var(--fujin-chrome-bg);
  border: 1px solid var(--fujin-border-default);
  border-radius: var(--fujin-radius-sm);
  box-shadow: var(--shadow);
  color: var(--fujin-text-secondary);
  font-size: 11px;
  line-height: 1.4;
  pointer-events: none;
  white-space: nowrap;
}

/* ---- cards & sections ---- */
.mc-page-title { font-size: 19px; font-weight: bold; margin: 0 0 2px; }
.mc-page-subtitle { color: var(--fujin-text-secondary); font-size: 12.5px; margin: 0 0 18px; }
.mc-card {
  background: var(--fujin-bg-elevated);
  border: 1px solid var(--fujin-border-subtle);
  border-radius: var(--fujin-radius-default);
  box-shadow: var(--shadow);
  margin-bottom: 18px;
  overflow: hidden;
}
.mc-card__title {
  padding: 10px 16px;
  background: var(--fujin-bg-elevated);
  border-bottom: 1px solid var(--fujin-border-subtle);
  font-size: 13px;
  font-weight: bold;
  display: flex;
  align-items: center;
  gap: 10px;
}
.mc-card__body { padding: 6px 16px 14px; }
.mc-card__note { color: var(--fujin-text-secondary); font-size: 12px; margin: 8px 0 0; }

/* ---- form rows ---- */
.mc-row {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 9px 0;
  border-bottom: 1px solid var(--fujin-border-subtle);
}
.mc-row:last-child { border-bottom: none; }
.mc-row__label { flex: 0 0 300px; color: var(--fujin-text-primary); font-size: 12.5px; }
.mc-row__label .hint { display: block; color: var(--fujin-text-muted); font-size: 11px; margin-top: 1px; }
.mc-row__control { flex: 1; min-width: 0; display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.mc-row__error { color: var(--fujin-status-danger); font-size: 11.5px; flex-basis: 100%; }
.mc-row.is-dirty .mc-row__label { color: var(--fujin-status-warning); }

/* ---- inputs ---- */
.mc-input, .mc-select, .mc-textarea {
  background: var(--fujin-bg-overlay);
  border: 1px solid var(--fujin-border-strong);
  border-radius: var(--fujin-radius-sm);
  color: var(--fujin-text-primary);
  font: inherit;
  font-size: 12.5px;
  padding: 5px 9px;
  min-width: 60px;
}
.mc-input:focus, .mc-select:focus, .mc-textarea:focus {
  outline: none;
  border-color: var(--fujin-interactive-active);
}
.mc-input::placeholder { color: var(--fujin-text-secondary); }
.mc-input.is-invalid, .mc-select.is-invalid { border-color: var(--fujin-status-danger); }
.mc-textarea { width: 100%; min-height: 90px; font-family: var(--fujin-font-family-mono); font-size: 12px; }
.mc-select option { background: var(--fujin-chrome-bg); }

/* ---- radio / toggle ---- */
.mc-radio-group { display: inline-flex; border: 1px solid var(--fujin-border-strong); border-radius: var(--fujin-radius-sm); overflow: hidden; }
.mc-radio-group button {
  background: var(--fujin-bg-overlay);
  border: none;
  color: var(--fujin-text-secondary);
  font: inherit;
  font-size: 12px;
  padding: 5px 14px;
  cursor: pointer;
}
.mc-radio-group button + button { border-left: 1px solid var(--fujin-border-strong); }
.mc-radio-group button.is-on { background: var(--fujin-interactive-default); color: #fff; }
.mc-toggle {
  position: relative;
  width: 40px; height: 21px;
  border-radius: var(--fujin-radius-default);
  border: 1px solid var(--fujin-border-strong);
  background: var(--fujin-bg-overlay);
  cursor: pointer;
  flex: none;
}
.mc-toggle::after {
  content: '';
  position: absolute;
  top: 2px; left: 2px;
  width: 15px; height: 15px;
  border-radius: var(--fujin-radius-default);
  background: var(--fujin-text-secondary);
  transition: left 0.12s, background 0.12s;
}
.mc-toggle.is-on { background: var(--fujin-interactive-default); border-color: var(--fujin-interactive-default); }
.mc-toggle.is-on::after { left: 21px; background: #fff; }

/* ---- buttons ---- */
.mc-btn {
  background: var(--fujin-bg-overlay);
  border: 1px solid var(--fujin-border-default);
  border-radius: var(--fujin-radius-sm);
  color: var(--fujin-text-primary);
  font: inherit;
  font-size: 12.5px;
  padding: 6px 16px;
  cursor: pointer;
}
.mc-btn:hover { border-color: var(--fujin-interactive-hover); }
.mc-btn:disabled { opacity: var(--fujin-opacity-disabled); cursor: default; }
.mc-btn--primary { background: var(--fujin-interactive-default); border-color: var(--fujin-interactive-default); }
.mc-btn--primary:hover:not(:disabled) { background: var(--fujin-interactive-active); border-color: var(--fujin-interactive-active); }
.mc-btn--danger { border-color: var(--fujin-status-danger); color: var(--fujin-status-danger); }
.mc-btn--sm { padding: 3px 10px; font-size: 11.5px; }

/* ---- tabs ---- */
.mc-tabs { display: flex; gap: 2px; margin-bottom: 16px; border-bottom: 1px solid var(--fujin-border-subtle); flex-wrap: wrap; }
.mc-tabs button {
  background: var(--fujin-bg-surface);
  border: 1px solid var(--fujin-border-subtle);
  border-bottom: none;
  border-radius: var(--fujin-radius-sm) var(--fujin-radius-sm) 0 0;
  color: var(--fujin-text-secondary);
  font: inherit;
  font-size: 12.5px;
  padding: 7px 16px;
  cursor: pointer;
}
.mc-tabs button.is-active { background: var(--fujin-bg-elevated); color: var(--fujin-text-primary); }

/* ---- tables ---- */
.mc-table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
.mc-table th {
  background: var(--fujin-chrome-bg);
  color: var(--fujin-text-secondary);
  text-align: left;
  padding: 7px 10px;
  border-bottom: 1px solid var(--fujin-border-subtle);
  font-weight: bold;
  white-space: nowrap;
}
.mc-table td { padding: 6px 10px; border-bottom: 1px solid var(--fujin-border-subtle); vertical-align: top; }
.mc-table tr:hover td { background: var(--fujin-bg-elevated); }
.mc-table--mono td { font-family: var(--fujin-font-family-mono); font-size: 11.5px; }
.mc-table__group td,
.mc-table tr.mc-table__group:hover td {
  background: var(--fujin-bg-surface);
  color: var(--fujin-text-secondary);
  font-weight: bold;
  font-size: 11.5px;
  letter-spacing: 0.3px;
}
.mc-table .num { text-align: right; font-family: var(--fujin-font-family-mono); }

/* ---- badges / status ---- */
.mc-badge {
  display: inline-block;
  padding: 1px 8px;
  border-radius: var(--fujin-radius-default);
  font-size: 10.5px;
  font-weight: bold;
  letter-spacing: 0.3px;
  background: var(--fujin-bg-surface);
  border: 1px solid var(--fujin-border-default);
  color: var(--fujin-text-secondary);
}
.mc-badge--ok { color: var(--fujin-status-success); border-color: var(--fujin-status-success); }
.mc-badge--warn { color: var(--fujin-status-warning); border-color: var(--fujin-status-warning); }
.mc-badge--err { color: var(--fujin-status-danger); border-color: var(--fujin-status-danger); }
.mc-badge--info { color: var(--fujin-status-info); border-color: var(--fujin-status-info); }
.mc-badge--wired { color: var(--badge-wired); border-color: var(--badge-wired); }
.mc-badge--24 { color: var(--badge-24); border-color: var(--badge-24); }
.mc-badge--5 { color: var(--badge-5); border-color: var(--badge-5); }
.mc-badge--6 { color: var(--badge-6); border-color: var(--badge-6); }

/* ---- banners ---- */
.mc-banner {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px 14px;
  border-radius: var(--fujin-radius-default);
  border: 1px solid var(--fujin-border-default);
  background: var(--fujin-bg-surface);
  color: var(--fujin-text-secondary);
  font-size: 12.5px;
  margin-bottom: 16px;
}
.mc-banner--warn { border-color: var(--fujin-status-warning); color: var(--fujin-status-warning); }
.mc-banner--err { border-color: var(--fujin-status-danger); color: var(--fujin-status-danger); }
.mc-banner--info { border-color: var(--fujin-status-info); }

/* ---- apply bar ---- */
.mc-applybar {
  position: absolute;
  left: 236px; right: 0; bottom: 0;
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 12px 26px;
  background: var(--fujin-chrome-bg);
  border-top: 1px solid var(--fujin-border-subtle);
  box-shadow: 0 -4px 8px rgba(0,0,0,0.6);
}
.mc-applybar__summary { color: var(--fujin-text-secondary); font-size: 12.5px; flex: 1; min-width: 0; }
.mc-applybar__summary b { color: var(--fujin-status-warning); }

/* ---- modal ---- */
.mc-modal-backdrop {
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.55);
  display: flex; align-items: center; justify-content: center;
  z-index: 2147483100;
}
.mc-modal {
  width: min(720px, 92vw);
  max-height: 84vh;
  display: flex; flex-direction: column;
  background: var(--fujin-bg-elevated);
  border: 1px solid var(--fujin-border-default);
  border-radius: var(--fujin-radius-default);
  box-shadow: var(--shadow);
}
.mc-modal__title { padding: 12px 18px; font-weight: bold; border-bottom: 1px solid var(--fujin-border-subtle); }
.mc-modal__body { padding: 14px 18px; overflow-y: auto; font-size: 12.5px; }
.mc-modal__footer { padding: 12px 18px; border-top: 1px solid var(--fujin-border-subtle); display: flex; justify-content: flex-end; gap: 10px; }
.mc-modal pre {
  background: var(--fujin-chrome-bg);
  border: 1px solid var(--fujin-border-subtle);
  border-radius: var(--fujin-radius-sm);
  padding: 10px;
  overflow-x: auto;
  white-space: pre-wrap;
  word-break: break-all;
}

/* ---- rule-list editor ---- */
.mc-row--stack { flex-direction: column; align-items: stretch; gap: 6px; }
.mc-row--stack .mc-row__label { flex-basis: auto; }
.mc-listedit { width: 100%; }
.mc-listedit .mc-input, .mc-listedit .mc-select { width: 100%; min-width: 0; padding: 4px 7px; font-size: 12px; }
.mc-listedit td { padding: 3px 4px; }
.mc-listedit th { padding: 5px 6px; font-size: 11.5px; }
.mc-listedit__empty { color: var(--fujin-text-muted); text-align: center; font-size: 12px; }
.mc-listedit__del {
  background: none; border: none; cursor: pointer;
  color: var(--fujin-text-muted); font-size: 12px; padding: 4px 6px;
}
.mc-listedit__del:hover { color: var(--fujin-status-danger); }
.mc-listedit__draft td { background: var(--fujin-bg-surface); }
.mc-listedit__bar { display: flex; align-items: center; gap: 12px; margin-top: 8px; }
.mc-listedit__count { color: var(--fujin-text-muted); font-size: 11.5px; margin-left: auto; }
.mc-input--mono { font-family: var(--fujin-font-family-mono); }

/* ---- log / feed views ---- */
.mc-logview {
  background: var(--fujin-chrome-bg);
  border: 1px solid var(--fujin-border-subtle);
  border-radius: var(--fujin-radius-sm);
  padding: 10px;
  max-height: 60vh;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-all;
  font-size: 11.5px;
  margin: 0;
}
.mc-feedbar { display: flex; align-items: center; gap: 14px; margin-bottom: 14px; }
.mc-feedbar__poll { display: flex; align-items: center; gap: 8px; color: var(--fujin-text-secondary); font-size: 12px; }

/* ---- traffic charts ---- */
.mc-ratechart {
  width: 100%;
  height: 150px;
  background: var(--fujin-chrome-bg);
  border: 1px solid var(--fujin-border-subtle);
  border-radius: var(--fujin-radius-sm);
}
.mc-legend { margin-left: auto; font-size: 11px; color: var(--fujin-text-secondary); display: inline-flex; align-items: center; gap: 6px; font-weight: normal; }
.mc-legend__swatch { width: 14px; height: 3px; display: inline-block; border-radius: var(--fujin-radius-default); }
.mc-legend__swatch.is-rx { background: var(--badge-24); }
.mc-legend__swatch.is-tx { background: var(--badge-5); }

/* ---- instance selector (band / VPN client N / …) ---- */
.mc-instancebar { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; }
.mc-instancebar__label { color: var(--fujin-text-secondary); font-size: 12.5px; }

/* ---- misc ---- */
.mc-loading { display: flex; align-items: center; gap: 10px; color: var(--fujin-text-secondary); padding: 30px 0; justify-content: center; }
.mc-spinner {
  /* Circular by functional necessity, not a themeable "roundedness" choice
     — see the file-header comment. */
  width: 18px; height: 18px;
  border: 2px solid var(--fujin-border-default);
  border-top-color: var(--fujin-interactive-active);
  border-radius: 50%;
  animation: mc-spin 0.8s linear infinite;
  flex: none;
}
@keyframes mc-spin { to { transform: rotate(360deg); } }
.mc-empty { color: var(--fujin-text-muted); text-align: center; padding: 26px 0; font-size: 12.5px; }
.mc-kv { display: grid; grid-template-columns: minmax(180px, 260px) 1fr; gap: 4px 16px; font-size: 12.5px; }
.mc-kv dt { color: var(--fujin-text-secondary); }
.mc-kv dd { margin: 0; font-family: var(--fujin-font-family-mono); font-size: 12px; word-break: break-all; }
.mc-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 0 26px; }
@media (max-width: 900px) {
  .mc-grid-2 { grid-template-columns: 1fr; }
  .mc-row { flex-direction: column; align-items: flex-start; gap: 4px; }
  .mc-row__label { flex-basis: auto; }
}
`;
}
