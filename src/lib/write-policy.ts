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
