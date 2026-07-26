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
