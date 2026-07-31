# Current State

**Branch:** main
**Push status:** local `main` is AHEAD of `origin/main` — the 2026-07-29
research/docs commits and the whole 2026-07-31 1.0-readiness pass are
local-only, held for operator review; pushing is an operator-authorized
step. (`origin/main` was last synced at `2d29065`, 2026-07-28.)

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

## This Session (2026-07-31) — 1.0-readiness pass

Orchestrated multi-agent pass; every solo-completable 1.0 item closed.
All work committed locally on `main`; **nothing pushed** (operator step).

- Dependency chain cleared: eslint 10, wxt 0.21, eslint-plugin-react
  removed (zero active rules) — `npm audit` 0 vulnerabilities (D-019).
- Popup migrated onto real Fujin tokens, shared resolution in
  `src/theme/vars.ts` (open loop closed).
- Screenshot fixture harness built (`tools/screenshot-harness/`); four
  1280×800 store screenshots captured, fictional data only — store
  listing asset-complete.
- Full-history secret scan closed: gitleaks 8.30.1 (88 commits, 6 false
  positives, all nvram key names) + trufflehog regex (0 findings).
- VPN write-path correctness: `ipsec_profile_2` lockstep regeneration
  shipped; OpenVPN/PPTP/IPSec rc actions now branch enable/disable like
  native (moots the rc stop-vs-restart question for this codebase).
  Live verification still operator-gated.
- Operator live session (read-only, operator-authorized, no writes):
  resolved the IPSec operator-fact question — zero IPSec accounts
  configured, `ipsec_profile_2` staleness cosmetic for this deployment
  (D-020); confirmed extension mount + popup restyle live; surfaced
  narrow-window layout defects and the Dashboard single-SSID defect.
- Narrow-window layout fixed (content-width container queries,
  fit-content label track, atomic values never split mid-token — the
  operator's acceptance criterion).
- Popup master enable/disable switch added (persisted `enabled` flag,
  router-origin-scoped tab reloads); store listing + privacy policy
  updated to three stored values (gh-pages duplicate needs manual sync).
- Dashboard SSID defect fixed network-centrically (one row per SDN
  network with band badges; classic fallback preserved) after a
  dedicated investigation (D-021).
- Note: the repo's commit-msg hook rejects Co-Authored-By trailers; all
  session commits carry the operator identity only.

---

## Prior Session (2026-07-29)

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
- The four write-path correctness questions are now all resolved or
  code-fixed at the source level (wireless band-token naming closed
  no-risk; WireGuard `wgs1_*` fixed `ae842e5`; `ipsec_profile_2`
  lockstep fixed `d8ca9ff`; rc restart/stop branching fixed `1b92640`) —
  what remains for each is live verification only, operator-gated. See
  `OPEN_LOOPS.md`.
- Twelve deferred features (SDN profile CRUD, WireGuard server peers,
  cert/key BLOBs, Operation Mode switching, and others) — full list in
  `OPEN_LOOPS.md` "Missing features."

## Known Constraints

- Not affiliated with ASUS or Asuswrt-Merlin (see README).
- `RAW/` (firmware source acquisition trees) is gitignored; not part of the
  distributed extension.
- `node_modules/` present locally (npm project); gitignored.
