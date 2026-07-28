# Work Log

## Entries

### 2026-07-27 — Migrated theme layer to a real Fujin dependency

- **Did:** Replaced the hand-copied `src/theme/fujin-tokens.ts` snapshot
  with a real `@fujin/ui` install (`github:StarlightDaemon/Fujin#v0.1.0`)
  and rewrote `src/theme/css.ts` to source `scalarVars`/`resolveDark('blue')`
  /`palette` from the package. `content.tsx` unchanged. Applied the `blue`
  accent preset, adopted Fujin's `0px` radius rule everywhere except the
  spinner (functional circle, not a themeable choice), repurposed Fujin's
  raw palette hues for the four connection-type badges, stayed dark-only.
  Full rationale and the design-call detail in `DECISIONS.md` D-005.
- **Result:** `tsc --noEmit`, `eslint`, and both `wxt build` (Chrome) and
  `wxt build -b firefox --mv3` clean. Visually verified against the real
  resolved token values via a throwaway shadow-root harness (not committed)
  covering cards, buttons, tabs, badges, banners, toggle, and the apply bar
  — blue accent, sharp corners, and badge colors all read correctly; the
  active/inactive tab distinction (a background-tier collision in the
  mechanical rename) was caught and fixed before this check. Registered in
  `Fujin/CONSUMERS.md` and `Raiden-ops/registry/EDGES.md`.
- **Loops:** none opened — this closes the "naming reference, not a real
  dependency" gap the 2026-07-26 fleet audit flagged for this repo.
- **Next:** live-hardware visual verification against the real router
  remains outstanding (the shadow-root harness is a stand-in, not a
  substitute — same gap as the pre-existing write-path verification work).

### 2026-07-26 — RAIDEN doctor cleanup: required state set completed, routing overlay seeded

- **Did:** Filled the required state file set that was absent after the Edict
  v2.0.0 install (`README.md`, `DECISIONS.md`, `WORK_LOG.md`, `GOALS.md`);
  seeded `.raiden/local/ROUTING.md` from the fleet-standard ladder plus a
  `.raiden/local/.gitignore` entry (this repo is public); removed the
  Edict-version restatement from `CURRENT_STATE.md` per fact-home discipline
  (the version lives solely in `.raiden/instance/metadata.json`).
- **Result:** `doctor` reports clean (0 WARN).
- **Loops:** none tracked — see `OPEN_LOOPS.md`.
- **Next:** operator review of the unpushed local commits ahead of
  `origin/main`; live-hardware verification of write paths beyond RT-BE92U.

### 2026-07-26 — RAIDEN Instance installed (Edict v2.0.0)

- **Did:** Installed a full-form RAIDEN Instance (`0301434`); untracked the
  pre-install committed audit report (`72c2a5f`, `git rm --cached`, kept on
  disk) to align with this install's public-repo `.audits/` gitignore policy.
- **Result:** `.raiden/writ`, `.raiden/local`, `.raiden/state`, and
  `.raiden/instance` present; baseline hashes match the v2.0.0 package
  manifest (confirmed by `doctor`'s `baseline_manifest` check).
- **Loops:** none opened.
- **Next:** resolve the doctor WARNs left by a fresh install (see the entry
  above, same day).

### 2026-07-25 — Licensing, disclosure, versioning, end-user docs

- **Did:** GPL verbatim-content audit of `src/` against the four GPL firmware
  trees (`36ac9cd`); added MIT `LICENSE` with `RAW/` and naming scope
  exclusion (`fc7cbf2`); non-affiliation disclaimer and corrected hardware
  claims in README (`5e28d35`); versioned `0.9.0-beta.1` and added
  `CHANGELOG.md` (`c332e8d`); added end-user `docs/GETTING_STARTED.md`
  (`970c43f`).
- **Result:** tsc + eslint clean; Chrome MV3 and Firefox MV3 builds pass and
  are current in `.output/`. Confirmed the read-only interlock defaults on
  across both independent layers (`settings.ts`, `write-guard.ts`) — no
  change needed.
- **Loops:** none tracked.
- **Next:** live verification of write paths; Firefox live verification.

### 2026-07-24 to 2026-07-25 — Navigation taxonomy implemented and Chrome-live-verified

- **Did:** Implemented the navigation taxonomy proposal (twelve-category
  tree with sub-headers, orphan consolidation, `NAV_ALIASES` secondary
  placements with alias-aware auto-expand, hover-only prior-name tooltips)
  across seven commits; fixed a `traffic-last24` nav-label regression the
  rename sweep introduced (`646a59d`).
- **Result:** Chrome live verification done against the operator's live
  RT-BE92U (read-only mode, no writes) — all 12 categories, sub-groups, and
  aliases confirmed correct including from a cold load; gate-off behavior
  (`nfsd_support`) observed live; console clean across ~23 navigations (46
  INFO messages, 0 errors).
- **Loops:** none tracked.
- **Next:** Firefox live verification remains not run (unchanged gap).

### 2026-07-24 — Foundation and initial page build

- **Did:** Scaffolded the WXT + React Manifest V3 project targeting Chrome
  and Firefox (`bb02d88`); built the foundation (manifest, router I/O layer,
  write guard, runtime capability detection, Fujin theme, app shell) and the
  first several page categories (`08e0982` through `7e4deba`).
- **Result:** read/write primitives and initial category coverage in place;
  the page build continued over the following sessions to the 73-view,
  67-native-page count recorded in `STATUS.md`.
- **Loops:** none tracked.
- **Next:** complete remaining categories; begin live verification.
