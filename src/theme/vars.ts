/**
 * Shared Fujin token resolution, used by both theme surfaces this extension
 * has: the shadow-root panel (`css.ts`, injected as `:host { ... }` inside
 * the content script's shadow DOM) and the popup (`popup-theme.ts`, injected
 * as `:root { ... }` into the popup's own document). Both surfaces must agree
 * on the same resolved values, so the resolution itself lives here once.
 *
 * Dark-only, `blue` accent preset — see .raiden/state/DECISIONS.md D-005.
 */
import { scalarVars, resolveDark, palette } from '@fujin/ui';

/**
 * `--badge-wired` / `--badge-24` / `--badge-5` / `--badge-6` (the connection-
 * type badges) are a local extension: Fujin's semantic system has no
 * categorical/qualitative role for a 4-way badge like this, so these are
 * pulled from Fujin's raw palette ramps instead of a semantic token.
 */
export const badgeVars: Record<string, string> = {
  '--badge-wired': palette.blue[5],
  '--badge-24': palette.green[5],
  '--badge-5': palette.orange[5],
  '--badge-6': palette.grape[5],
};

/** The full set of `--fujin-*` (plus local `--badge-*`) custom properties this extension uses. */
export function buildThemeVars(): Record<string, string> {
  return {
    ...scalarVars,
    ...resolveDark('blue'),
    ...badgeVars,
  };
}

/** Renders a vars map as newline-joined `  --name: value;` declaration lines. */
export function varsToCssLines(vars: Record<string, string>): string {
  return Object.entries(vars)
    .map(([name, value]) => `  ${name}: ${value};`)
    .join('\n');
}
