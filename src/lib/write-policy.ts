/**
 * Write-exclusion policy.
 *
 * This module owns the `writeExclusion` category vocabulary AND the predicate
 * the write chokepoint enforces. It deliberately lives in `lib/` rather than
 * `pages/` so that `router-io.ts` (WriteSpec) and `write-guard.ts` can depend
 * on it without a cycle through the page-definition contract; `pages/types.ts`
 * re-exports the category type so page defs keep their existing import.
 *
 * Why this is not a toggle:
 *
 * Five categories — wireless, wan, dhcp, vpn, firewall — are hard-excluded by
 * the project's own scoping, and STATUS.md § "Known open items" 2 and 3 state
 * that these paths require a dedicated human-supervised live verification pass
 * before any write is ever cleared. That verification has not happened. So the
 * block below is UNCONDITIONAL: it is enforced ahead of, and independently of,
 * the global `readOnlyMode` interlock, and turning read-only mode off does not
 * lift it. Clearing a category is a deliberate source change here, made only
 * once the corresponding open item is closed.
 *
 * The remaining tags ('firmware-reboot-reset', 'excluded-restart',
 * 'restricted-misc') are NOT in the hard-block set. They remain diagnostic tags
 * governed by the ordinary read-only interlock, unchanged by this policy.
 */

/**
 * Hard-excluded live-write categories from the operator's scoping. Pages
 * tagged with one of these have fully implemented write paths that this build
 * session never live-submits; the UI surfaces that state in diagnostics.
 */
export type WriteExclusionCategory =
  | 'wireless'
  | 'wan'
  | 'dhcp'
  | 'vpn'
  | 'firewall'
  | 'firmware-reboot-reset'
  | 'excluded-restart' // action_script touches restart_net_and_phy / restart_wireless / restart_wan / restart_dhcpd, or is unclear enough to exclude by policy
  | 'restricted-misc' // http_dut_redir, SSH forwarding, HTTPS cert regen, SMB protocol, UPnP pinholes
  | null;

/**
 * The categories whose writes are refused outright, regardless of settings.
 * Every page def carrying one of these is unreachable from `submitBuiltWrite`.
 */
export const HARD_EXCLUDED_WRITE_CATEGORIES = ['wireless', 'wan', 'dhcp', 'vpn', 'firewall'] as const;

export type HardExcludedWriteCategory = (typeof HARD_EXCLUDED_WRITE_CATEGORIES)[number];

/** True when writes in this category must never be submitted. */
export function isHardExcludedWriteCategory(
  category: WriteExclusionCategory | undefined,
): category is HardExcludedWriteCategory {
  return (
    category != null && (HARD_EXCLUDED_WRITE_CATEGORIES as readonly string[]).includes(category)
  );
}

/**
 * Confirmation copy for disabling the global read-only interlock. Shared by
 * every control that can turn it off (popup toggle, Extension Settings toggle)
 * so the warning cannot drift between them.
 */
export const DISABLE_READONLY_CONFIRM =
  'Disable read-only mode?\n\n' +
  'Apply buttons will send real changes to your router instead of previewing ' +
  'the request. Changes are applied immediately and some restart router ' +
  'services.\n\n' +
  'Leave read-only mode ON unless you intend to make live changes.';

/** Operator-facing explanation shown wherever a write is refused. */
export function hardExclusionReason(category: HardExcludedWriteCategory): string {
  return (
    `Writes in the "${category}" category are hard-excluded pending a supervised live ` +
    `verification session, and are blocked unconditionally — turning read-only mode off ` +
    `does not enable them.`
  );
}

// ---------------------------------------------------------------------------
// Confirmation timing policy
// ---------------------------------------------------------------------------

/**
 * How long the write chokepoint keeps re-reading nvram before it stops and
 * reports the write as unconfirmed, and how long it waits before it starts.
 *
 * This is a *confirmation* policy, not a write policy: it changes nothing about
 * what is submitted, to whom, or whether a write is permitted at all. It exists
 * because different writes take wildly different times to land — `tweaks` sends
 * `restart_conntrack` (measured at 13–16 ms) while `switch-ctrl` sends `reboot`
 * — and a single global ceiling cannot serve both. A ceiling that is too short
 * does not make a write fail; it makes a write that *did* land get reported as
 * unconfirmed, which is strictly worse than waiting.
 *
 * The window is derived, in order of precedence:
 *  1. an explicit per-def `confirmTimeoutMs` override, if the def sets one;
 *  2. otherwise, twice the def's own `actionWait` (the native page's client-side
 *     wait for the same operation — the best per-path signal in the tree),
 *     floored at the exclusion category's ceiling below.
 *
 * The ceilings are upper bounds on patience, not expected waits: the poll loop
 * returns the instant nvram matches, so a generous ceiling costs nothing on a
 * fast path.
 */
export interface ConfirmWindow {
  /** ms to wait after submit before the FIRST forced-fresh read. */
  settleMs: number;
  /** Total ms budget measured from entry, settle included. */
  timeoutMs: number;
  /** ms between polls. */
  intervalMs: number;
}

/**
 * Per-category confirmation ceilings, in ms. Sourced from the disruption
 * profile each tag denotes, cross-checked against docs/verification/wave-*.md:
 *  - firmware-reboot-reset: a full device reboot (`switch-ctrl`, actionWait 120)
 *  - excluded-restart:      restart_net / restart_net_and_phy (30–60 s observed
 *                           expectation; `ipv6` actionWait 30, `lan-ip` 35)
 *  - wan:                   `dual-wan` reboots (actionWait 70); WAN re-establish
 *                           can take 30–60 s
 *  - dhcp:                  restart_net_and_phy (actionWait 30)
 *  - wireless:              restart_wireless, all radios (~20 s expectation)
 *  - vpn / firewall / restricted-misc: single-daemon or iptables restarts
 *
 * The five hard-excluded categories never reach verification today (guardedWrite
 * refuses them before submit); their entries are here so the table stays total
 * and stays correct if a category is ever cleared.
 */
const CONFIRM_CEILING_MS: Record<NonNullable<WriteExclusionCategory>, number> = {
  'firmware-reboot-reset': 180_000,
  'excluded-restart': 90_000,
  wan: 120_000,
  dhcp: 90_000,
  wireless: 45_000,
  vpn: 30_000,
  firewall: 30_000,
  'restricted-misc': 30_000,
};

/** Ceiling for an untagged (routine) write. */
export const DEFAULT_CONFIRM_CEILING_MS = 30_000;

/** Absolute cap, so a bad per-def value cannot hang the UI indefinitely. */
export const CONFIRM_CEILING_LIMIT_MS = 300_000;

/** Poll interval; the slower one applies to windows past the routine ceiling. */
const POLL_INTERVAL_MS = 800;
const SLOW_POLL_INTERVAL_MS = 2_000;

/**
 * Resolve the confirmation window for one write. Takes primitives rather than a
 * WriteSpec so this module stays free of a cycle back through router-io.ts.
 *
 * @param category            the def's writeExclusion tag (null = untagged)
 * @param actionWaitSeconds   the def's actionWait, i.e. the native page's own
 *                            client-side wait for this operation
 * @param explicitTimeoutMs   per-def override, when a path needs one
 */
export function confirmWindow(
  category: WriteExclusionCategory | undefined,
  actionWaitSeconds: number | undefined,
  explicitTimeoutMs?: number,
): ConfirmWindow {
  const settleMs = Math.max(0, Math.round((actionWaitSeconds ?? 0) * 1000));
  const categoryCeiling =
    category != null ? CONFIRM_CEILING_MS[category] : DEFAULT_CONFIRM_CEILING_MS;
  const derived = Math.max(settleMs * 2, categoryCeiling);
  const timeoutMs = Math.min(
    Math.max(0, explicitTimeoutMs ?? derived),
    CONFIRM_CEILING_LIMIT_MS,
  );
  return {
    settleMs: Math.min(settleMs, timeoutMs),
    timeoutMs,
    intervalMs: timeoutMs > DEFAULT_CONFIRM_CEILING_MS ? SLOW_POLL_INTERVAL_MS : POLL_INTERVAL_MS,
  };
}
