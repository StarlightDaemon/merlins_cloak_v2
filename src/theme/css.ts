/**
 * The Fujin theme, materialized. Builds the complete stylesheet injected as a
 * <style> element at the shadow root (external stylesheets and @import do not
 * work inside a shadow root). All colors flow from the typed token map in
 * fujin-tokens.ts; semantic additions (error/success/warn) are derived here.
 */
import { fujinTokens as t } from './fujin-tokens';

export const semantic = {
  success: t.ghz24, // #44cc88
  warn: t.textHint, // #ffcc00
  error: '#e06055',
  info: t.textLink, // #569ac7
};

export function buildThemeCss(): string {
  return `
:host {
  all: initial;
  --bg-page: ${t.bgPage};
  --bg-dark: ${t.bgDark};
  --bg-status: ${t.bgStatus};
  --bg-overlay: ${t.bgOverlay};
  --bg-title: ${t.bgTitle};
  --nav-bg: ${t.navBg};
  --block-bg: ${t.blockBg};
  --content-bg: ${t.contentBg};
  --cell-bg: ${t.cellBg};
  --input-bg: ${t.inputBg};
  --border-dark: ${t.borderDark};
  --border-menu: ${t.borderMenu};
  --border-input: ${t.borderInput};
  --border-card: ${t.borderCard};
  --text-primary: ${t.textPrimary};
  --text-secondary: ${t.textSecondary};
  --text-muted: ${t.textMuted};
  --text-link: ${t.textLink};
  --text-hint: ${t.textHint};
  --accent-hover: ${t.accentHover};
  --accent-btn: ${t.accentBtn};
  --accent-bright: ${t.accentBright};
  --badge-wired: ${t.wired};
  --badge-24: ${t.ghz24};
  --badge-5: ${t.ghz5};
  --badge-6: ${t.ghz6};
  --ok: ${semantic.success};
  --warn: ${semantic.warn};
  --err: ${semantic.error};
  --info: ${semantic.info};
  --shadow: 0 2px 12px ${t.shadowColor};
  --font-base: ${t.fontBase};
  --font-mono: ${t.fontMono};
  --radius: 6px;
  --radius-sm: 4px;
}

/* ---- resets, scoped to the shadow tree ---- */
*, *::before, *::after { box-sizing: border-box; }
.mc-app {
  font-family: var(--font-base);
  font-size: 13px;
  line-height: 1.5;
  color: var(--text-primary);
  background: var(--bg-page);
  position: fixed;
  inset: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  z-index: 2147483000;
}
.mc-app a { color: var(--text-link); text-decoration: none; }
.mc-app a:hover { color: var(--accent-hover); text-decoration: underline; }
.mc-app code, .mc-app pre { font-family: var(--font-mono); font-size: 12px; }

/* ---- header ---- */
.mc-header {
  height: 52px;
  flex: none;
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 0 18px;
  background: var(--bg-dark);
  border-bottom: 1px solid var(--border-dark);
}
.mc-header__brand {
  font-weight: bold;
  font-size: 15px;
  letter-spacing: 0.4px;
  white-space: nowrap;
}
.mc-header__brand em { color: var(--accent-bright); font-style: normal; }
.mc-header__identity {
  color: var(--text-secondary);
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
  border-radius: 999px;
  background: var(--bg-status);
  border: 1px solid var(--border-menu);
  color: var(--text-secondary);
  font-size: 11.5px;
  white-space: nowrap;
}
.mc-header__chip .dot { width: 8px; height: 8px; border-radius: 50%; background: var(--text-muted); }
.mc-header__chip.is-ok .dot { background: var(--ok); }
.mc-header__chip.is-warn .dot { background: var(--warn); }
.mc-header__chip.is-err .dot { background: var(--err); }

/* ---- body layout ---- */
.mc-body { flex: 1; display: flex; min-height: 0; }
.mc-nav {
  width: 236px;
  flex: none;
  overflow-y: auto;
  background: var(--bg-status);
  border-right: 1px solid var(--border-dark);
  padding: 10px 0 24px;
}
.mc-main {
  flex: 1;
  min-width: 0;
  overflow-y: auto;
  padding: 20px 26px 90px;
  scrollbar-color: var(--accent-bright) var(--bg-dark);
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
  color: var(--text-secondary);
  font: inherit;
  font-size: 12.5px;
  font-weight: bold;
  cursor: pointer;
  text-align: left;
}
.mc-nav__group-title:hover { color: var(--text-primary); }
.mc-nav__group-title .chev { margin-left: auto; font-size: 10px; opacity: 0.7; transition: transform 0.12s; }
.mc-nav__group.is-open .chev { transform: rotate(90deg); }
.mc-nav__sub { margin-bottom: 2px; }
.mc-nav__subheader {
  padding: 7px 16px 2px 28px;
  font-size: 10px;
  font-weight: bold;
  letter-spacing: 0.8px;
  text-transform: uppercase;
  color: var(--text-muted);
}
.mc-nav__item {
  display: block;
  width: 100%;
  padding: 6px 16px 6px 32px;
  background: none;
  border: none;
  border-left: 3px solid transparent;
  color: var(--text-secondary);
  font: inherit;
  font-size: 12.5px;
  cursor: pointer;
  text-align: left;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.mc-nav__item:hover { color: var(--text-primary); background: var(--bg-overlay); }
.mc-nav__item.is-active {
  color: var(--text-primary);
  background: var(--bg-overlay);
  border-left-color: var(--accent-bright);
}

/* ---- cards & sections ---- */
.mc-page-title { font-size: 19px; font-weight: bold; margin: 0 0 2px; }
.mc-page-subtitle { color: var(--text-secondary); font-size: 12.5px; margin: 0 0 18px; }
.mc-card {
  background: var(--bg-overlay);
  border: 1px solid var(--border-dark);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  margin-bottom: 18px;
  overflow: hidden;
}
.mc-card__title {
  padding: 10px 16px;
  background: var(--bg-title);
  border-bottom: 1px solid var(--border-dark);
  font-size: 13px;
  font-weight: bold;
  display: flex;
  align-items: center;
  gap: 10px;
}
.mc-card__body { padding: 6px 16px 14px; }
.mc-card__note { color: var(--text-secondary); font-size: 12px; margin: 8px 0 0; }

/* ---- form rows ---- */
.mc-row {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 9px 0;
  border-bottom: 1px solid ${t.shadowColor.replace('0.5', '0.18')};
}
.mc-row:last-child { border-bottom: none; }
.mc-row__label { flex: 0 0 300px; color: var(--text-primary); font-size: 12.5px; }
.mc-row__label .hint { display: block; color: var(--text-muted); font-size: 11px; margin-top: 1px; }
.mc-row__control { flex: 1; min-width: 0; display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.mc-row__error { color: var(--err); font-size: 11.5px; flex-basis: 100%; }
.mc-row.is-dirty .mc-row__label { color: var(--text-hint); }

/* ---- inputs ---- */
.mc-input, .mc-select, .mc-textarea {
  background: var(--input-bg);
  border: 1px solid var(--border-input);
  border-radius: var(--radius-sm);
  color: var(--text-primary);
  font: inherit;
  font-size: 12.5px;
  padding: 5px 9px;
  min-width: 60px;
}
.mc-input:focus, .mc-select:focus, .mc-textarea:focus {
  outline: none;
  border-color: var(--accent-bright);
}
.mc-input::placeholder { color: var(--text-secondary); }
.mc-input.is-invalid, .mc-select.is-invalid { border-color: var(--err); }
.mc-textarea { width: 100%; min-height: 90px; font-family: var(--font-mono); font-size: 12px; }
.mc-select option { background: var(--bg-dark); }

/* ---- radio / toggle ---- */
.mc-radio-group { display: inline-flex; border: 1px solid var(--border-input); border-radius: var(--radius-sm); overflow: hidden; }
.mc-radio-group button {
  background: var(--input-bg);
  border: none;
  color: var(--text-secondary);
  font: inherit;
  font-size: 12px;
  padding: 5px 14px;
  cursor: pointer;
}
.mc-radio-group button + button { border-left: 1px solid var(--border-input); }
.mc-radio-group button.is-on { background: var(--accent-btn); color: #fff; }
.mc-toggle {
  position: relative;
  width: 40px; height: 21px;
  border-radius: 999px;
  border: 1px solid var(--border-input);
  background: var(--input-bg);
  cursor: pointer;
  flex: none;
}
.mc-toggle::after {
  content: '';
  position: absolute;
  top: 2px; left: 2px;
  width: 15px; height: 15px;
  border-radius: 50%;
  background: var(--text-secondary);
  transition: left 0.12s, background 0.12s;
}
.mc-toggle.is-on { background: var(--accent-btn); border-color: var(--accent-btn); }
.mc-toggle.is-on::after { left: 21px; background: #fff; }

/* ---- buttons ---- */
.mc-btn {
  background: var(--block-bg);
  border: 1px solid var(--border-menu);
  border-radius: var(--radius-sm);
  color: var(--text-primary);
  font: inherit;
  font-size: 12.5px;
  padding: 6px 16px;
  cursor: pointer;
}
.mc-btn:hover { border-color: var(--accent-hover); }
.mc-btn:disabled { opacity: 0.45; cursor: default; }
.mc-btn--primary { background: var(--accent-btn); border-color: var(--accent-btn); }
.mc-btn--primary:hover:not(:disabled) { background: var(--accent-bright); border-color: var(--accent-bright); }
.mc-btn--danger { border-color: var(--err); color: var(--err); }
.mc-btn--sm { padding: 3px 10px; font-size: 11.5px; }

/* ---- tabs ---- */
.mc-tabs { display: flex; gap: 2px; margin-bottom: 16px; border-bottom: 1px solid var(--border-dark); flex-wrap: wrap; }
.mc-tabs button {
  background: var(--bg-title);
  border: 1px solid var(--border-dark);
  border-bottom: none;
  border-radius: var(--radius-sm) var(--radius-sm) 0 0;
  color: var(--text-secondary);
  font: inherit;
  font-size: 12.5px;
  padding: 7px 16px;
  cursor: pointer;
}
.mc-tabs button.is-active { background: var(--content-bg); color: var(--text-primary); }

/* ---- tables ---- */
.mc-table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
.mc-table th {
  background: var(--bg-dark);
  color: var(--text-secondary);
  text-align: left;
  padding: 7px 10px;
  border-bottom: 1px solid var(--border-dark);
  font-weight: bold;
  white-space: nowrap;
}
.mc-table td { padding: 6px 10px; border-bottom: 1px solid ${t.shadowColor.replace('0.5', '0.18')}; vertical-align: top; }
.mc-table tr:hover td { background: var(--bg-overlay); }
.mc-table--mono td { font-family: var(--font-mono); font-size: 11.5px; }
.mc-table .num { text-align: right; font-family: var(--font-mono); }

/* ---- badges / status ---- */
.mc-badge {
  display: inline-block;
  padding: 1px 8px;
  border-radius: 999px;
  font-size: 10.5px;
  font-weight: bold;
  letter-spacing: 0.3px;
  background: var(--bg-status);
  border: 1px solid var(--border-menu);
  color: var(--text-secondary);
}
.mc-badge--ok { color: var(--ok); border-color: var(--ok); }
.mc-badge--warn { color: var(--warn); border-color: var(--warn); }
.mc-badge--err { color: var(--err); border-color: var(--err); }
.mc-badge--info { color: var(--info); border-color: var(--info); }
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
  border-radius: var(--radius);
  border: 1px solid var(--border-menu);
  background: var(--bg-status);
  color: var(--text-secondary);
  font-size: 12.5px;
  margin-bottom: 16px;
}
.mc-banner--warn { border-color: var(--warn); color: var(--warn); }
.mc-banner--err { border-color: var(--err); color: var(--err); }
.mc-banner--info { border-color: var(--info); }

/* ---- apply bar ---- */
.mc-applybar {
  position: absolute;
  left: 236px; right: 0; bottom: 0;
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 12px 26px;
  background: var(--bg-dark);
  border-top: 1px solid var(--border-dark);
  box-shadow: 0 -2px 12px ${t.shadowColor};
}
.mc-applybar__summary { color: var(--text-secondary); font-size: 12.5px; flex: 1; min-width: 0; }
.mc-applybar__summary b { color: var(--text-hint); }

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
  background: var(--bg-overlay);
  border: 1px solid var(--border-menu);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
}
.mc-modal__title { padding: 12px 18px; font-weight: bold; border-bottom: 1px solid var(--border-dark); }
.mc-modal__body { padding: 14px 18px; overflow-y: auto; font-size: 12.5px; }
.mc-modal__footer { padding: 12px 18px; border-top: 1px solid var(--border-dark); display: flex; justify-content: flex-end; gap: 10px; }
.mc-modal pre {
  background: var(--bg-dark);
  border: 1px solid var(--border-dark);
  border-radius: var(--radius-sm);
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
.mc-listedit__empty { color: var(--text-muted); text-align: center; font-size: 12px; }
.mc-listedit__del {
  background: none; border: none; cursor: pointer;
  color: var(--text-muted); font-size: 12px; padding: 4px 6px;
}
.mc-listedit__del:hover { color: var(--err); }
.mc-listedit__draft td { background: var(--bg-status); }
.mc-listedit__bar { display: flex; align-items: center; gap: 12px; margin-top: 8px; }
.mc-listedit__count { color: var(--text-muted); font-size: 11.5px; margin-left: auto; }
.mc-input--mono { font-family: var(--font-mono); }

/* ---- log / feed views ---- */
.mc-logview {
  background: var(--bg-dark);
  border: 1px solid var(--border-dark);
  border-radius: var(--radius-sm);
  padding: 10px;
  max-height: 60vh;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-all;
  font-size: 11.5px;
  margin: 0;
}
.mc-feedbar { display: flex; align-items: center; gap: 14px; margin-bottom: 14px; }
.mc-feedbar__poll { display: flex; align-items: center; gap: 8px; color: var(--text-secondary); font-size: 12px; }

/* ---- traffic charts ---- */
.mc-ratechart {
  width: 100%;
  height: 150px;
  background: var(--bg-dark);
  border: 1px solid var(--border-dark);
  border-radius: var(--radius-sm);
}
.mc-legend { margin-left: auto; font-size: 11px; color: var(--text-secondary); display: inline-flex; align-items: center; gap: 6px; font-weight: normal; }
.mc-legend__swatch { width: 14px; height: 3px; display: inline-block; border-radius: 2px; }
.mc-legend__swatch.is-rx { background: var(--badge-24); }
.mc-legend__swatch.is-tx { background: var(--badge-5); }

/* ---- instance selector (band / VPN client N / …) ---- */
.mc-instancebar { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; }
.mc-instancebar__label { color: var(--text-secondary); font-size: 12.5px; }

/* ---- misc ---- */
.mc-loading { display: flex; align-items: center; gap: 10px; color: var(--text-secondary); padding: 30px 0; justify-content: center; }
.mc-spinner {
  width: 18px; height: 18px;
  border: 2px solid var(--border-menu);
  border-top-color: var(--accent-bright);
  border-radius: 50%;
  animation: mc-spin 0.8s linear infinite;
  flex: none;
}
@keyframes mc-spin { to { transform: rotate(360deg); } }
.mc-empty { color: var(--text-muted); text-align: center; padding: 26px 0; font-size: 12.5px; }
.mc-kv { display: grid; grid-template-columns: minmax(180px, 260px) 1fr; gap: 4px 16px; font-size: 12.5px; }
.mc-kv dt { color: var(--text-secondary); }
.mc-kv dd { margin: 0; font-family: var(--font-mono); font-size: 12px; word-break: break-all; }
.mc-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 0 26px; }
@media (max-width: 900px) {
  .mc-grid-2 { grid-template-columns: 1fr; }
  .mc-row { flex-direction: column; align-items: flex-start; gap: 4px; }
  .mc-row__label { flex-basis: auto; }
}
`;
}
