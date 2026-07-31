/**
 * The Fujin theme, materialized for the popup. Unlike the content-script
 * panel (`css.ts`), the popup is a normal top-level extension page, not a
 * shadow-root injection — there is no `:host` to target and no isolation
 * concern, so the same resolved token set from `./vars.ts` is written to
 * `:root` instead, via a plain `<style>` element appended to `<head>` at
 * popup load. See `./vars.ts` and .raiden/state/DECISIONS.md D-005 for why
 * `blue` and dark-only.
 */
import { buildThemeVars, varsToCssLines } from './vars';

const STYLE_ID = 'mc-popup-theme';

function buildPopupThemeCss(): string {
  return `:root {\n${varsToCssLines(buildThemeVars())}\n}`;
}

/**
 * Injects the Fujin `:root` variables into the popup document. Idempotent —
 * safe to call more than once (e.g. React StrictMode / HMR re-execution)
 * without leaving duplicate `<style>` elements behind.
 */
export function injectPopupTheme(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = buildPopupThemeCss();
  document.head.appendChild(style);
}
