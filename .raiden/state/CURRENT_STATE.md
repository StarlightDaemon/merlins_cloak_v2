# Current State

**Branch:** main
**Push status:** local main is 52 commits ahead of `origin/main`, 0 behind. All 52 are held local, unpushed pending operator review.

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

## Confirmed Current State

- RAIDEN Instance installed at Edict v2.0.0 (this install). Fleet form: full
  (writ + local overlay + state + instance metadata).
- Supersedes the ledger-form Instance **merlins_cloak** (the original
  userscript repo), deprecated 2026-07-25 in favor of this rewrite. See
  Raiden-ops `registry/instances.md` Retired/Identity-Resolved section.
- GitHub repo `StarlightDaemon/merlins_cloak_v2` exists and is public;
  `origin/main` is 7 commits (initial WXT/React scaffold + research docs),
  an ancestor of local `main`.
- tsc + eslint clean; Chrome MV3 and Firefox MV3 builds pass and are current
  in `.output/`.
- GPL verbatim-content audit clean (`docs/LICENSE_AUDIT.md`) against the
  four GPL firmware trees in `RAW/`.
- A committed audit report (`.audits/merlins_cloak_v2_AUDIT_2026-07-25.md`)
  predates this install's public-repo `.audits/` gitignore policy; it was
  untracked (`git rm --cached`, kept on disk) as part of this install in a
  separate commit — see git log.

## In Progress

- Live-hardware verification of write paths beyond the single verified
  router (RT-BE92U); RT-AX88U and other models remain structural-only or
  untested (see README Compatibility table).
- Operator review of the 52 unpushed local commits ahead of `origin/main`.

## Not Yet Done

- Full Firefox live verification (structural/build-verified only per
  STATUS.md).
- Broader write-path live verification across additional hardware.

## Known Constraints

- Not affiliated with ASUS or Asuswrt-Merlin (see README).
- `RAW/` (firmware source acquisition trees) is gitignored; not part of the
  distributed extension.
- `node_modules/` present locally (npm project); gitignored.
