# Current State

**Branch:** main
**Push status:** local `main` and `origin/main` are identical (both at
`2d29065`). Fully pushed as of 2026-07-28 — see `GOALS.md` Achieved goals.

---

## Project

Merlin's Cloak v2 is a Manifest V3 browser extension (WXT + React, targeting
Chrome and Firefox) that replaces the Asuswrt-Merlin router web UI with a
client-side interface. It is a rebuild of the original userscript
(`StarlightDaemon/merlins_cloak`), which this RAIDEN Instance now supersedes
as the fleet's tracked form of the project.

**Status:** pre-release (`0.9.0-beta.1`). 73 views implemented over 67 native
pages; read paths broadly exercised; write paths implemented but almost
entirely unverified against live hardware. Read-only interlock defaults on.
Full detail: [README.md](../../README.md), [STATUS.md](../../STATUS.md),
[CHANGELOG.md](../../CHANGELOG.md).

---

## This Session (2026-07-29)

- The WireGuard server write path was found critically broken: saves
  posted directly-indexed `wgs1` prefixed nvram keys that the firmware's
  write path never recognized, so saves silently did nothing on the
  router while appearing to succeed client-side. This was researched,
  fixed, and independently re-verified from scratch after an initial
  mischaracterization of the underlying mechanism was caught and
  corrected. Full record: `DECISIONS.md` D-006 through D-015.
- Three related open loops were also researched this session: wireless
  band-token naming, `ipsec_profile_2` regeneration, and `rcService`
  restart versus stop branching. One closed as no risk; two remain open,
  pending either operator deployment facts or live testing.
- Local commit history was reviewed three times before push, including
  one independent second-opinion pass, and pushed clean.
- A public GitHub Pages site now exists for this project, live at
  https://starlightdaemon.github.io/merlins_cloak_v2/, served from a
  separate `gh-pages` branch that is not merged with and does not share
  history with `main`. The site is themed using this project's actual
  Fujin design tokens, not a generic template. A privacy policy page
  exists at that site as a manually maintained duplicate of
  `docs/privacy-policy.md` on `main`; the two are not automatically
  synced and must be updated by hand together if the policy ever
  changes.

---

## Confirmed Current State

- RAIDEN Instance installed (Edict version tracked in
  `.raiden/instance/metadata.json`). Fleet form: full (writ + local overlay +
  state + instance metadata).
- Supersedes the ledger-form Instance **merlins_cloak** (the original
  userscript repo), deprecated 2026-07-25 in favor of this rewrite. See
  Raiden-ops `registry/instances.md` Retired/Identity-Resolved section.
- GitHub repo `StarlightDaemon/merlins_cloak_v2` exists and is public;
  `origin/main` fully reflects local `main`, including the theme-layer
  migration to a real `@fujin/ui` dependency, dependency vulnerability
  fixes (uuid/tmp/esbuild overrides, `npm audit` clean), the Firefox
  sources-ZIP fix (no longer bundles the local `RAW/` firmware dumps), and
  the Chrome Web Store readiness docs.
- tsc + eslint clean; Chrome MV3 and Firefox MV3 builds pass and are current
  in `.output/`, including exported `.zip` packages for both browsers.
- GPL verbatim-content audit clean (`docs/LICENSE_AUDIT.md`) against the
  four GPL firmware trees in `RAW/`.
- A committed audit report (`.audits/merlins_cloak_v2_AUDIT_2026-07-25.md`)
  predates this install's public-repo `.audits/` gitignore policy; it was
  untracked (`git rm --cached`, kept on disk) as part of this install in a
  separate commit — see git log.
- Chrome Web Store listing materially drafted: privacy policy live via
  GitHub Pages, store copy/permissions justification/data-disclosure
  answers written. See `GOALS.md` "Chrome Web Store submission readiness."

## In Progress

- Live-hardware verification of write paths beyond the single verified
  router (RT-BE92U); RT-AX88U and other models remain structural-only or
  untested (see README Compatibility table).
- Chrome Web Store submission readiness — screenshots remain the one open,
  solo-completable piece; see `OPEN_LOOPS.md`.

## Not Yet Done

- Full Firefox live verification (structural/build-verified only per
  STATUS.md).
- Broader write-path live verification across additional hardware.
- Four source-research-completable write-path correctness questions
  (wireless band-token naming, WireGuard server `wgs1_*` writes,
  `ipsec_profile_2` regeneration, `rcService` restart/stop branching) — see
  `OPEN_LOOPS.md`.
- Twelve deferred features (SDN profile CRUD, WireGuard server peers,
  cert/key BLOBs, Operation Mode switching, and others) — full list in
  `OPEN_LOOPS.md` "Missing features."

## Known Constraints

- Not affiliated with ASUS or Asuswrt-Merlin (see README).
- `RAW/` (firmware source acquisition trees) is gitignored; not part of the
  distributed extension.
- `node_modules/` present locally (npm project); gitignored.
