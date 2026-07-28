# Decisions

## D-001

- Date: 2026-07-24 (approx, scaffold commit `bb02d88`)
- Status: Active
- Decision: Merlin's Cloak v2 is a ground-up Manifest V3 browser extension (WXT +
  React) that replaces the native Asuswrt-Merlin web UI pages, rather than
  restyling them in place as the v1 userscript
  (`StarlightDaemon/merlins_cloak`, `asus-merlin-ui.user.js`) did. Only the
  Fujin design token set (`src/theme/fujin-tokens.ts`) carries across from v1.
- Rationale: replacing rather than restyling native pages allows independent
  write-path validation, a read-only-by-default interlock, and a maintainable
  component architecture that the userscript's in-place restyling approach
  could not offer equivalent write-safety guarantees for.

## D-002

- Date: 2026-07-25
- Status: Active
- Decision: Project is licensed MIT, with a scope note excluding `RAW/`
  (gitignored GPL firmware source acquisition trees) and the ASUS/Asuswrt-Merlin
  names and label wording the client reuses descriptively.
- Rationale: the GPL verbatim-content audit (`docs/LICENSE_AUDIT.md`, commit
  `36ac9cd`) found no material verbatim GPL code carried into `src/` (~12.5k
  lines checked against all four GPL trees in `RAW/`), aside from a small
  number of short UI label phrases and one widely-published regex idiom, both
  recorded as non-blocking. The client is original code that reads/writes
  router state but does not embed GPL source.

## D-003

- Date: 2026-07-25
- Status: Active
- Decision: Version `0.9.0-beta.1` is explicitly a beta, not a release
  candidate. README/STATUS distinguish live-verified (RT-BE92U only) from
  structural-only (RT-AX88U, never contacted) from untested hardware, and
  state ROG/GT variants as out of scope rather than merely untested.
- Rationale: Firefox has never been loaded against a live router, and 48 of
  the 49 implemented write paths have never been submitted to one — calling
  this an RC would overstate verification coverage that does not exist yet.

## D-004

- Date: 2026-07-26
- Status: Active
- Decision: This repo is installed as a full-form RAIDEN Instance (Edict
  v2.0.0) and supersedes the ledger-form Instance `merlins_cloak` (the
  original userscript repo), deprecated 2026-07-25, as the fleet's tracked
  form of the project.
- Rationale: v2 is a complete rebuild and is now the actively developed form
  of the project; the userscript repo remains on disk but is retired from
  active RAIDEN tracking.
- Implementation note: the Raiden-ops registry row for this instance was
  already updated as part of that deprecation and is out of scope for this
  install pass.

## D-005

- Date: 2026-07-27
- Status: Active
- Decision: replaced the hand-copied Fujin token snapshot
  (`src/theme/fujin-tokens.ts`, frozen at whatever the v1 userscript's
  "FUJIN TOKEN MAP" looked like) with a real `@fujin/ui` dependency
  (`npm install github:StarlightDaemon/Fujin#v0.1.0`, per Fujin's own
  `docs/INTEGRATION_GUIDE.md`). `src/theme/css.ts` now sources
  `scalarVars`/`resolveDark`/`palette` from the package at content-script
  load time instead of interpolating hardcoded hex values; `content.tsx`
  is unchanged (the existing `<style>`-in-shadow-root pattern already
  matched the guide's recommended isolation approach for an untrusted host
  page). Per Raiden-ops `state/DECISIONS.md` OPS-D-007, which scoped
  merlins_cloak_v2 as one of the repos that should carry real Fujin
  theming.
- Four scoped design calls, all made with the operator:
  - **Accent:** Fujin's `blue` preset, not the `violet` default — closest
    match to this extension's existing blue identity.
  - **Radius:** Fujin's `0px`-everywhere rule adopted faithfully, including
    the toggle switch and status dot (matches Fujin's own precedent of
    forcing Mantine's `Switch` to 0 too). The one deliberate exception is
    `.mc-spinner`'s `border-radius: 50%`, kept as a literal — a functional
    requirement of a rotating-ring loading indicator, not a themeable
    roundedness choice.
  - **Connection badges** (wired/2.4GHz/5GHz/6GHz): Fujin has no semantic
    role for a 4-way categorical badge, so these pull from Fujin's raw
    palette ramps (`palette.blue/green/orange/grape[5]`) instead of
    one-off hex values.
  - **Mode:** dark-only. `ExtensionSettings` has no theme field and nothing
    asked for a light/dark toggle; `resolveLight` is unused.
- Rationale: the fleet-wide consumption audit
  (`Raiden-ops/reports/FUJIN_CONSUMPTION_AUDIT_2026-07-26.md`) flagged this
  repo as exactly the kind of naming-only reference that silently drifts —
  a snapshot frozen at whatever Fujin looked like when copied, with no path
  for a later Fujin token change to reach it. A real dependency closes that
  gap: a Fujin token rename or removal now surfaces as a build/typecheck
  failure here, not silent drift.
- Consequence: five background-tier collisions in the mechanical old-var
  → new-var rename (Fujin has 4-5 dark surface tiers where the old palette
  had 8 distinct roles) were resolved by hand rather than left to collapse
  arbitrarily — most visibly, `.mc-tabs button` (inactive) and
  `.mc-tabs button.is-active` were deliberately kept on different tiers
  (`--fujin-bg-surface` vs `--fujin-bg-elevated`) so the active/inactive
  tab state stays visually distinguishable. Several colors shifted hue or
  brightness by design (primary text is now `#c9c9c9`, not pure white;
  the link/hint colors moved onto Fujin's `interactive`/`status` roles).
  Registered in `Fujin/CONSUMERS.md` and `Raiden-ops/registry/EDGES.md`
  (`merlins_cloak_v2 → Fujin`, type `build-dep`) in the same pass.
