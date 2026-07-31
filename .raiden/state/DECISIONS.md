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

## D-006

- Date: 2026-07-28
- Status: Closed (no further action)
- Decision: Researched whether `validate_instance` in the firmware httpd
  source treats band-role-token (`2g1_`/`5g1_`/`6g1_`) nvram keys as
  equivalent to this project's canonical `wl` prefixed keys (`wl0_`/`wl1_`/
  `wl2_`) for wireless writes. Finding: no alias or equivalence logic exists
  in the write path at all. The firmware write path (`validate_instance`,
  web.c:3749–3753) only ever accepts `wl` prefixed keys built by walking
  `wl_ifnames` unit indices. Band-role-token to `wl` prefixed key mapping
  exists only in `ej_wl_nvram_get` (web.c:1213–1248), used solely for GET
  rendering. Original open loop framed this as a risk to confirm; actual
  result is the opposite — this project's existing key format is the only
  one the firmware write path accepts.
- Rationale: `src/pages/defs/wireless.ts` posts 33 distinct `wl{p}_*` keys
  via `httpApi.nvramSet`. The firmware's `validate_apply` → `validate_instance`
  chain does not rewrite or map any of these to band-token form. Two adjacent
  questions surfaced but not answered by this research: whether
  `Advanced_Wireless_Content.asp` translates band-token keys client-side
  before posting, and whether unit index to physical radio band mapping
  (2.4 GHz vs. 5 GHz vs. 6 GHz) is correct. Neither rises to a new open loop
  on its own; logged as observations in `OPEN_LOOPS.md` ("Client-side band-
  token translation" and "Physical radio band index mapping").

## D-007

- Date: 2026-07-28
- Status: Confirmed open (no closure date)
- Decision: Researched whether a `validate_instance` branch exists for `wgs1`
  prefixed nvram keys, following up on a leap of faith flagged during the
  original WireGuard server implementation. Finding: no such branch exists.
  The only WireGuard server write handling in the firmware write path is a
  redirect in `validate_apply` (web.c:4746–4755), which recognizes only the
  unindexed `wgs_enable` plus `wgs_unit` posting pattern and builds the
  indexed form internally. It does not recognize an already-indexed key
  posted directly, which is the form this project uses. Unlike the wireless
  key research recorded in D-006, this is not a closed, no-risk finding.
  This confirms the original leap of faith as a real gap. All seven writable
  `wgs1` prefixed keys (`enable`, `dns`, `nat6`, `psk`, `alive`, `addr`,
  `port`) are unvalidated by any known mechanism in the write path.
- Rationale: Severity and next step undetermined pending a follow-up
  research pass on what `validate_apply` does with an unrecognized key —
  silent drop, rejection, or unconditional write-through — since that
  determines whether this is a broken feature (drop = nvram writes no-op),
  a cosmetic gap (rejection = user sees error, no harm), or a real but
  currently inert risk (unconditional write with unknown downstream
  consumer). Logged as confirmed open in `OPEN_LOOPS.md`, not closed.

## D-008

- Date: 2026-07-29
- Status: Closed (findings documented in `OPEN_LOOPS.md`)
- Decision: Researched the D-007 follow-up: what validate_apply does with a
  posted key matching no defaults table entry and no validate_instance branch.
  Finding: validate_apply's only two loops walk the static router_defaults
  and router_state_defaults tables directly, confirmed at web.c around line
  4316 and 5063, meaning an unmatched posted key such as any of the seven
  wgs1 prefixed keys this project posts is never read out of the request body
  at all. It is not dropped by an explicit check, it is structurally never
  inspected. It cannot be written to nvram, produces no error, and produces
  no log output. Call path confirmed as the exact path httpApi.nvramSet
  exercises, applyapp.cgi through action_mode apply, at web.c around line
  13135 through 13195.
- Rationale: This resolves D-007's open question with a critical finding:
  WireGuard server saves in this project's UI currently do nothing on the
  router, while appearing to succeed client side. Severity raised from high to
  critical. This is now understood as a functionally broken feature requiring
  an implementation fix, not a validation gap requiring a defensive check.
  Root cause is structural: the table-driven validation loop never attempts to
  read an unmatched key from the posted request, so it is impossible to
  validate or reject it — it is simply never seen. Documented in `OPEN_LOOPS.md`
  with practical consequence and next steps.
- **Verification (2026-07-29):** independently re-checked against two
  third-party audit reports that also flagged this as Critical
  (`.audits/merlins_cloak_v2_AUDIT_VERIFICATION_2026-07-29.md`). The
  re-check re-derived the same conclusion from primary source rather than
  trusting this decision's own citations: confirmed `router_defaults[]`'s
  actual entries directly in `shared/defaults.c` (not just the `extern`
  declaration in `web.c`) contain only unindexed `wgs_*` names, no `wgs1_*`
  entry exists anywhere in the table, and `get_cgi_json()` does a
  hash-keyed lookup (`json_object_object_get_ex`) against the parsed POST
  body — confirming the drop is structural, not merely likely. Severity
  Critical stands confirmed. That pass also discovered a fix for this exact
  finding already drafted, uncommitted, in the working tree's
  `src/pages/defs/vpn-server.ts`, from a session with no record in this
  decision log at the time. That fix has since been committed and
  independently re-verified from scratch, including the correction owed to
  its own inline reasoning noted at the time — see D-015 for the full
  re-verification and resolution.

## D-009

- Date: 2026-07-29
- Status: Confirmed open (conditional risk, documented in `OPEN_LOOPS.md`)
- Decision: Researched what triggers ipsec_profile_2 regeneration natively
  and whether this project's UI needs to reproduce it. Finding: native firmware
  regenerates ipsec_profile_2 in lockstep with ipsec_profile_1 on every IPSec
  save, confirmed at Advanced_VPN_IPSec.asp around line 641 through 654 and
  web.c around line 18394 through 18519. This project's UI updates
  ipsec_profile_1 on save but not ipsec_profile_2, which goes stale after any
  virtual subnet or DNS hostname change. Downstream impact could not be fully
  confirmed because the actual IKEv2 or strongswan config generator that
  consumes ipsec_profile_2 is not present anywhere in this repository's GPL
  source dump. Verdict is conditional on a fact about the operator's actual
  deployment: safe if no configured client is IKEv2 capable, a live risk of
  unconfirmed severity if any account is version 2 or version 3. Also
  corrected a file path error carried over from the original open loop, the
  IPSec fields live in src/pages/defs/ipsec.ts, not vpn-server.ts as
  previously recorded. Logged as confirmed open, conditional, in
  OPEN_LOOPS.md.
- Rationale: This answers the question posed in OPEN_LOOPS.md's ipsec_profile_2
  entry with a conditional finding: the regeneration happens on every client-
  and server-side save, lockstep between the two profiles, and omitting it
  creates a potential IKEv2 stale-config risk that cannot be ruled out from
  available GPL source without knowing the operator's actual deployment. The
  safe/unsafe verdict depends on whether any of their configured IPSec client
  accounts use IKEv2, a fact about their setup, not resolvable from firmware
  source code alone. Documented in OPEN_LOOPS.md with precise citations and
  next steps.
- **Verification (2026-07-29):** independently re-checked against two
  third-party audit reports that both flagged this as High
  (`.audits/merlins_cloak_v2_AUDIT_VERIFICATION_2026-07-29.md`). Severity
  High is confirmed, and the re-check adds a nuance this decision's
  original research did not surface: firmware has a **second, dedicated**
  write path for IPSec profiles (`do_set_ipsec_profile_cgi`, reached via
  `set_ipsec_profile.cgi`, `web.c:18394-18519`) that independently
  reconstructs *both* `ipsec_profile_1` and `ipsec_profile_2` server-side
  from raw inputs on every save — which would have auto-regenerated
  `ipsec_profile_2` even without client-side help, refuting this finding,
  **if this project used that endpoint**. It does not: `ipsec.ts`'s write
  path uses the generic `applyapp` endpoint (the same table-driven path
  characterized in D-008), which has no such derivation logic. Confirmed
  separately that `ipsec_profile_1` (unlike WireGuard's `wgs1_*` keys) *is*
  a literal `router_defaults` entry, so this project's `ipsec_profile_1`
  write does land in nvram — this is a staleness gap, not a D-008-style
  silent total drop. Conditional framing (depends on whether the operator
  has any IKEv2-capable IPSec client account) stands unresolved and is now
  additionally logged as its own standalone entry in `OPEN_LOOPS.md`
  ("IPSec `ipsec_profile_2` prioritization — needs an operator deployment
  fact") so it isn't only reachable as a sub-paragraph here.

## D-010

- Date: 2026-07-29
- Status: Confirmed open (split verdict by service, partially unresolved, documented in `OPEN_LOOPS.md`)
- Decision: Researched what native firmware calls for enable versus disable transitions
  on VPN servers and IPSec, and whether this project's static-restart
  simplification is safe. Finding splits by service. WireGuard server: native
  itself uses a static, direction-agnostic restart, confirmed at
  Advanced_WireguardServer_Content.asp around line 111, so this project's
  simplification introduces no divergence there, though this is currently
  moot per D-007 and D-008 since WireGuard server writes do not reach nvram
  at all. OpenVPN server, PPTP server, and IPSec: native firmware maintains a
  separate stop action distinct from restart specifically for the disable
  direction, confirmed at Advanced_VPN_OpenVPN.asp around line 630 through
  634, Advanced_VPN_PPTP.asp around line 320 through 322 and 433 through 434,
  and Advanced_VPN_IPSec.asp around line 687 through 692. This project always
  calls the restart action regardless of direction for these three. Whether
  this actually leaves a service running after a UI disable could not be
  confirmed, because the rc daemon source implementing these actions is
  absent from every firmware dump in this repository. Circumstantial
  evidence, native's deliberate maintenance of a separate stop path,
  suggests this is a real risk rather than a harmless simplification, but
  this is evidence, not proof. Also corrected a file path error the same
  pattern as D-009's, the rcService open loop cited router-io.ts as holding
  service-specific logic when the actual static values live in the page def
  files. Logged as confirmed open, split verdict, partially unresolved, in
  OPEN_LOOPS.md.
- Rationale: This research closes the question posed in OPEN_LOOPS.md's
  rcService entry with a split finding: WireGuard server's simplification is
  harmless (native does the same), but OpenVPN, PPTP, and IPSec's separate
  stop paths exist deliberately in native firmware. The absence of rc daemon
  source that implements those paths prevents confirmation of whether calling
  restart unconditionally would actually leave services running after a UI
  disable. Native's deliberate choice to maintain separate stop actions
  suggests this matters in practice, but the evidence is circumstantial,
  not definitive. This is now documented with precise citations and requires
  either locating the missing rc daemon source or live testing to close.
- **Verification and disagreement resolution (2026-07-29):** two
  third-party audit reports independently flagged this same finding but
  disagreed on severity — one rated it Medium, the other High
  (`.audits/merlins_cloak_v2_AUDIT_VERIFICATION_2026-07-29.md`). Resolved
  as **High for OpenVPN, PPTP, and IPSec; not applicable to WireGuard**
  (confirmed no divergence there — native itself is a static restart, per
  this decision's own original finding above), by independent reasoning
  rather than by picking either report's number:
  - Re-confirmed directly against this project's own code (not just the
    general claim) that all three static values are exactly as this
    decision already found: `restart_vpnserver{p}` (OpenVPN),
    `restart_pptpd` (PPTP), `ipsec_start` (IPSec) — no enable/disable
    branch exists in `lib/router-io.ts`'s `WriteSpec` type or in any of
    the three consuming page defs.
  - The failure mode this gap could produce — a VPN/remote-access server
    the user explicitly disabled through this UI continuing to accept
    connections, with no daemon-status readback in this UI to contradict
    the nvram flag it shows — is a security-boundary-silently-not-enforced
    class of bug, which is High-severity territory on the cost of the
    failure alone, independent of how likely it is to occur.
  - The circumstantial evidence isn't weak: native firmware maintains this
    exact restart/stop split, independently, across three unrelated
    subsystems, each its own `.asp` with its own JS. A vendor doesn't
    typically carry a redundant, triplicated code path without a
    functional reason.
  - This project's own risk posture already hard-excludes the `vpn`
    write-exclusion category pending verification — rating this Medium
    would be inconsistent with the bar the project already holds itself to
    for VPN-adjacent correctness.
  - Not raised to Critical: unlike D-008's WireGuard finding, this remains
    a genuinely open empirical question (whether the underlying rc script
    self-terminates on a disabled flag) rather than a source-proven
    failure — the two unresolved conditions in this decision's own
    "Rationale" section above are exactly what keeps this from being
    Critical, and exactly why it shouldn't be discounted to Medium either.
  The empirical question itself (what the rc script for each service
  actually does with a disabled flag) remains exactly as unresolved as
  this decision originally found — now additionally logged as its own
  standalone entry in `OPEN_LOOPS.md` ("rc daemon stop-vs-restart behavior
  — blocked, source unavailable") rather than only as a sub-paragraph here.

## D-011

- Date: 2026-07-29
- Status: Closed (no further action)
- Decision: Confirmed the unit value one used in the WireGuard server write
  path fix. `Advanced_WireguardServer_Content.asp`'s `wgs_unit` field is a
  select element with a single hardcoded option, value one, pre-selected and
  not changeable client side, confirmed at `Advanced_WireguardServer_Content.asp`
  around line 149 through 150. This confirms `wgs_unit` equals one is correct
  for this project's write path. Separately, this research found the backend
  is not architecturally limited to one WireGuard server instance. A constant
  `WG_SERVER_MAX` equal to two exists, confirmed at `vpn_utils.h` around line
  148, and backend code iterates and formats `wgs` prefixed nvram keys and
  interface names by unit number generically rather than hardcoding unit one,
  confirmed at `vpn_utils.c` around line 457 and `web.c` at multiple lines
  including around 2795, 2809, 26832, 26841, 40338, 40355, 40377, and 40398.
  No occurrence of a WireGuard server unit value of two being actually written
  or read in practice was found; the ceiling constant exists but is never
  exercised anywhere in native source. The one instance limit is a restriction
  of the `Advanced_WireguardServer_Content.asp` UI page itself, which never
  exposes a second instance, not a backend or nvram schema limit.
- Rationale: The write-path fix itself remains correct for the single instance
  this project currently supports. The architectural capability for a second
  instance, while not exercised in native practice, is documented as a new
  missing feature in `OPEN_LOOPS.md` rather than a correction to the fix,
  since the fix itself is correct in scope.

## D-012

- Date: 2026-07-29
- Status: Closed (investigation complete; findings logged in `OPEN_LOOPS.md`)
- Decision: Attempted external web research to resolve the D-009 and D-010
  residual gaps, both of which trace to the same underlying wall: the rc daemon
  source implementing restart and stop actions, and the process consuming
  ipsec_profile_2, are absent from this repository's local GPL source dump.
  Three research passes were made. The first, a broad research synthesis,
  produced some real citations but also one materially wrong citation,
  attributing a claim about this project's own nvram variable to an
  unrelated third party project. The second repeated the same broad
  synthesis with full source URLs, which allowed the wrong citation to be
  caught, and surfaced two specific unexamined files, rc.c and config.in,
  that a targeted follow-up could check directly. The third, a targeted
  direct fetch request against those two specific files, failed: the
  research tool disclosed it could not perform live external URL fetches and
  substituted fabricated content presented in the same format as a genuine
  finding, including a claim labeled confirmed that PPTP server support has
  been removed from modern firmware branches. That claim is discarded
  entirely, is not evidence of anything, and must not be cited or relied
  upon. No new reliable information was obtained across all three passes
  beyond what this repository's own local source research had already
  established. This external research avenue is not currently effective for
  closing gaps caused by source files missing from the local GPL dump, and
  should not be reused for these two open loops without a materially
  different method. Both loops remain open and unresolved, unchanged in
  status from D-009 and D-010, logged in OPEN_LOOPS.md.
- Rationale: External research methodology proved ineffective for this
  specific class of gap — missing source files from the GPL dump that exist
  only on a live router or live system. The research tool's inability to
  perform live URL fetches, combined with its substitution of fabricated
  content for missing files, introduced a failure mode that is indistinguishable
  from legitimate findings until manually verified, which defeats the purpose
  of using external research as an independent confirmation mechanism. For
  D-009 and D-010, the only reliable next steps are locating the missing GPL
  source outside this repository or live testing against actual hardware.

## D-015

- Date: 2026-07-29
- Status: Closed (source-level resolution complete; two items remain open
  for live testing only — see `OPEN_LOOPS.md`)
- Decision: Definitively resolved the wgs_unit and wgs_ redirect mechanism in
  validate_apply, reconciling a contradiction between the original D-007 and
  D-008 characterization and a separately surfaced, unverified claim about
  posted field order. An independent, from scratch re-read of web.c and
  cgi.c in full confirms D-008's table driven loop finding was exactly
  right, re-derived independently rather than assumed. The unit assignment
  around web.c line 4379 through 4406 and the wgs_ redirect around web.c
  line 4746 through 4755 are two arms of the same else-if chain inside the
  single loop over the static router_defaults table, around web.c line 4316
  through 5060, not over the posted request body. get_cgi_json around cgi.c
  line 94 through 115, and the underlying get_cgi and hsearch_r path, are
  both name-keyed lookups against the fully parsed posted body, confirmed
  directly from source. Posted field order is irrelevant. What actually
  determines correctness: wgs_unit must be present anywhere in the posted
  body, and wgs_unit's position in the static router_defaults table, around
  shared defaults.c line 5416, must precede the other wgs_ entries at line
  5417 through 5425, which it already does, independent of anything the
  client does. The originally committed inline code comment describing this
  as a POST ordering requirement was factually wrong about the mechanism,
  though the resulting client behavior was harmless, since wgs_unit is
  unconditionally included in every save regardless of position. The comment
  has been corrected in this same history cleanup to describe the real
  requirement. This independently reconfirms D-007 and D-008: the pre-fix
  approach of posting already-indexed wgs1_ keys directly could never have
  worked, since validate_apply never reads a posted key that is not a name
  from the static table. Verdict on the shipped fix: correct, confirmed via
  full independent source verification. Two things remain genuinely
  unresolved and require live testing, not further source research: whether
  the actual deployed firmware matches this exact RAW/merlin tree with
  RTCONFIG_WIREGUARD defined, and whether restart_wgs actually applies the
  redirected values to the running WireGuard interface.

## D-013

- Date: 2026-07-29
- Status: Closed (no further action needed to confirm the finding; fix
  itself is a separate, unscheduled follow-up — see `OPEN_LOOPS.md` cross-
  reference below if one is added)
- Decision: Verified two third-party audit reports' shared claim
  (`.audits/merlins_cloak_v2_AUDIT_VERIFICATION_2026-07-29.md`) that the 9
  High-severity `npm audit` findings in this repository all trace to a
  single root cause — `brace-expansion` (GHSA-mh99-v99m-4gvg) — cascading
  through `minimatch` into `eslint`, `eslint-plugin-react`, and `wxt` (via
  `web-ext-run`/`multimatch`). Re-ran `npm audit --json` fresh rather than
  trusting either report's numbers: confirmed exactly 9 High findings, 0 of
  any other severity, and confirmed the dependency chain matches the
  reports' description exactly. Separately checked this against the
  2026-07-27 fleet-wide vulnerability remediation pass (commits `7853eea`:
  shell-quote, adm-zip; `99b7a92`: uuid, tmp, esbuild): **zero overlap** —
  none of those five already-pinned packages appear in the current 9
  findings. This is not a regression or something newly discovered by
  either audit: commit `99b7a92`'s own message already identified this
  exact `brace-expansion` instance at the time and explicitly deferred it
  ("Fixing it needs a minimatch major bump across eslint,
  eslint-plugin-react, and wxt's web-ext-run — left for a separate pass"),
  and recorded `npm audit` as reporting 0 vulnerabilities immediately after
  that commit — consistent with these 9 being a known, intentionally-
  deferred gap that reappeared only because it was never itself fixed, not
  because anything regressed.
- Rationale: all 9 findings are dev-only (`npm audit`'s own dependency
  metadata: `"prod": 5` — react/react-dom and peers — against a 669-package
  dev graph carrying all 9); nothing vulnerable ships in the built
  extension artifact. Every one of the 9 findings' suggested fix carries
  `isSemVerMajor: true` — there is no available non-major (`npm audit fix`)
  resolution. Notably, npm's own suggested `eslint-plugin-react` target
  (7.22.0) is *below* the current constraint (`^7.37.5`), meaning the
  mechanical `--force` resolution path is not trustworthy here and any fix
  needs a manually-verified upgrade path across `eslint` (9→10),
  `eslint-plugin-react`, and `wxt` (0.20→0.21), each re-verified against
  `tsc --noEmit`, `eslint`, and both Chrome/Firefox builds. This fix is
  fully implementable and testable without any router or live-hardware
  involvement — it is not subject to the VPN/firewall write-path
  hard-exclusion policy that gates D-007 through D-010's fixes.

## D-014

- Date: 2026-07-29
- Status: Closed
- Decision: Resolved a disagreement between two third-party audit reports
  over `src/entrypoints/background.ts`'s `onMessage` listener (`mc2-collect-
  flags`, around line 78) — one rated it High ("unvalidated execution sink":
  executes a function in `sender.tab.id` without validating sender origin
  or ID), the other Info (read-only capability detection, no privileged
  effect). Resolved as **Info**, independently, not by picking either
  report's number:
  - Read the executed function, `collectSupportFlags`
    (`background.ts:56-72`), in full: it enumerates the calling tab's own
    `window` global property names, filters to a `_support`-suffixed
    subset (the router firmware's own capability-flag convention, already
    read elsewhere in this codebase via `nvram_get` and gated on via
    `lib/capabilities.ts`'s `hasFlag()`), and returns only primitive
    values or a `'{}'` stub for object-shaped ones. No navigation, no
    `fetch`/`XMLHttpRequest`, no DOM mutation, no storage write, no nvram
    or router interaction of any kind.
  - Confirmed reachability rather than assuming it: `wxt.config.ts`
    declares no `externally_connectable`, so by the WebExtensions platform
    contract `onMessage` (unlike `onMessageExternal`) only fires for
    messages from this extension's own contexts — not arbitrary web-page
    JS, not other extensions. Grepped every call site of
    `mc2-collect-flags`: the only sender is `src/lib/capabilities.ts`,
    itself only running inside this extension's own content script, which
    itself only mounts on pages passing `content.tsx`'s host/path/page-
    shape guards.
  - Conclusion: the "unvalidated execution sink" framing is an accurate
    description of the code pattern (no `sender.id`/`sender.origin` check
    exists) but there is no reachable attacker who benefits from the
    missing check — the platform already restricts who can call this
    handler at all, and the function itself has no privileged effect to
    abuse even if it could be invoked with an attacker-chosen `tabId`
    (which it cannot be — `sender.tab.id` is platform-supplied). The High
    framing appears to pattern-match "unvalidated message → executeScript"
    without confirming what the executed function does or whether the
    handler is actually reachable by an untrusted party.
  - The one real residual risk this path carries is entirely downstream of
    the host-permissions finding (broad `optional_host_permissions`): if
    the content script is ever induced to mount somewhere it shouldn't,
    that page's `window` globals could be fingerprinted via this path.
    That risk is already captured by the host-permissions item; it is not
    a separate High-severity issue in the message handler itself.
- Rationale: optional defense-in-depth only — a `sender.id !==
  browser.runtime.id` check would be consistent with security best
  practice and is Trivial effort, Localized blast radius, but is not
  functionally required given the current permission surface and would not
  change behavior today. No action item opened; this decision record exists
  to preserve the reasoning behind the severity downgrade so it isn't
  re-litigated from scratch by a future pass re-reading the same two
  reports.

## D-016

- Date: 2026-07-29
- Status: Closed (completeness verification complete)
- Decision: Cross-checked the full 2026-07-29 audit-verification report
  against this repository's tracked history, to confirm completeness before
  treating the audit-verification-pass consolidation commit as final. Of
  eleven distinct sections in the source report, eight were already
  captured with reasonable fidelity across D-008 through D-015 and the
  corresponding OPEN_LOOPS.md entries. Three were missing and have been
  added: a Content Security Policy finding, confirmed Info, no action
  needed; a .gitignore recommendation, refuted as already stale when the
  report was written; and a full-history secret scan, confirmed only
  partial, not a full entropy scan, remaining open and actionable, separate
  from and not undermining the two independent clean secret-diff reviews
  already performed on this session's own commits. Also recorded a
  methodology caveat from the source report itself: only one of its two
  source third-party audit reports exists as a file in this repository, the
  second was checked only against a paraphrase, not read directly. This
  closes the completeness question for this specific report's findings. It
  does not represent a full-history secret scan having been completed; that
  remains tracked as its own open item in OPEN_LOOPS.md.
- Rationale: The audit-verification pass's own consolidation into
  `OPEN_LOOPS.md` entries and corresponding decision records is now
  complete, with all distinct findings cross-checked against tracked
  history. Three findings that did not appear in earlier decisions have
  been added to maintain a complete record. The caveat about report
  methodology (one source report unverified) is documented in
  OPEN_LOOPS.md's new reliability-caveat paragraph and here as part of the
  closure, so that any future reference to disagreements between the two
  source reports carries this context forward. The full-history secret scan
  remains open and is now its own explicit item in OPEN_LOOPS.md, distinct
  from the two independent clean reviews already performed on this
  session's own new commits.

## D-017

- Date: 2026-07-29
- Status: Closed (fact recorded; no fleet-wide correction made)
- Decision: Confirmed genuine Fujin design token consumption in this
  project during unrelated work on a GitHub Pages landing page. This
  project's content-script panel imports and resolves real values from
  the `@fujin/ui` package, live, in `src/theme/css.ts`. This contradicts
  a fleet-wide recorded finding that zero real Fujin dependents exist
  across approximately twenty-one repos; this project is a genuine,
  verified exception. Separately, this project's own popup UI does not
  consume Fujin at all and is independently styled, logged as its own
  open loop.
- Rationale: Whether the fleet-wide Fujin consumption record itself needs
  correcting is a cross-repository question outside this project's own
  scope, noted here only as a fact discovered during this session, not
  acted upon.

## D-018

- Date: 2026-07-29
- Status: Closed (factual note, not a decision)
- Decision: During this session, two separate Claude Code sessions
  operated against this repository's shared working tree concurrently at
  least twice, without either session being aware of the other. Each
  time, one session observed unexplained branch or file state changes
  mid-task, caused by the other session's activity, and correctly paused
  rather than acting on unexplained state. No data was lost in either
  case, but each incident required a manual status check and explanation
  before work could safely continue.
- Rationale: Logged so future sessions are aware this has happened
  before: avoid running more than one active Claude Code session against
  this repository's working tree at the same time, particularly during
  any git branch operation.

## D-019

- Date: 2026-07-31
- Status: Closed
- Decision: Removed `eslint-plugin-react` entirely (`ec717ca`) instead of
  overriding its vulnerable nested `minimatch`/`brace-expansion` chain, as
  the final step of clearing the 9-High `npm audit` chain D-013 confirmed
  (the first step being the coordinated eslint 9→10 / wxt 0.20→0.21 major
  bumps, `3f4e5c5`). Basis: the plugin contributed zero active rules —
  `eslint.config.js` extended no preset of it and its only rule reference
  was `react/react-in-jsx-scope: 'off'`, which disables a rule that was
  never enabled; and the override path was verified broken empirically
  (patched minimatch ≥10 / brace-expansion ≥5.0.8 changed their CommonJS
  entry points from callable default exports to named-export objects,
  which would throw "is not a function" inside the plugin's own rule
  files the moment any of them was enabled). Removing an inert dependency
  beat shipping a landmine override. `eslint-plugin-react-hooks` and its
  two active rules are untouched. `npm audit` reports 0 vulnerabilities.
- Consequence: if react-specific lint rules are ever wanted, re-adding
  the plugin requires an eslint-10-compatible release (none existed as of
  2026-07-31; 7.37.5 was latest, peer-capped at eslint ^9.7).

## D-020

- Date: 2026-07-31
- Status: Closed
- Decision: The `ipsec_profile_2` prioritization question (D-009's
  conditional; OPEN_LOOPS' standalone entry) was resolved by an
  operator-authorized, strictly read-only live session against the
  RT-BE92U driven through the operator's own authenticated browser: the
  IPSec VPN server is disabled, no pre-shared key is set, and the client
  account table is empty — zero IPSec accounts exist, so no account is
  IKEv2-capable. Verdict: the staleness gap was cosmetic for this
  deployment; it re-arms only if IPSec accounts are ever configured. The
  session made no writes of any kind and never touched the read-only
  interlock; the only actions were navigation clicks and screenshots.
  The same session also live-confirmed the extension's mount, identity
  detection (227 flags), and surfaced the narrow-window layout defects
  fixed later the same day (`75a1c18`, `34423f5`).
- Note: the code-level lockstep fix (`d8ca9ff`) was implemented the same
  day independently of this verdict — correct for any deployment, not
  just this one. See D-021's sibling records in OPEN_LOOPS for what
  remains live-verification-only.

## D-021

- Date: 2026-07-31
- Status: Closed (implementation shipped; Option C deferred)
- Decision: For the operator-reported "one SSID shown everywhere" defect,
  adopted the investigation's Option B — the Dashboard's wireless card is
  network-centric on SDN firmware (one row per enabled non-backhaul
  `sdn_rl` record, its own `apg{idx}_ssid`, band badges decoded from
  `apg{idx}_dut_list`, per-band `wl{N}_radio` state kept as a strip;
  classic non-SDN fallback preserved unchanged) — implemented in
  `0df9636` with parsing shared between dashboard and the SDN overview
  via new `src/lib/sdn.ts`. Option A (relabel-only) was subsumed; Option
  C (fixing `wireless.ts`'s SSID read/edit semantics on SDN units) was
  explicitly deferred as a write-path change with an unresolved
  nvram-key-family question — tracked in OPEN_LOOPS ("Wireless-general
  SSID semantics on SDN units"), not to be attempted without a
  supervised session.
- Rationale: the defect was a data-model mismatch (band→SSID table shape
  vs. the SDN many-to-many model), not a lookup bug; the native UI's own
  information architecture (one section per network with band icons,
  confirmed live in docs/LIVE_PROBE_RT-BE92U.md) is the correct shape,
  and sdn.tsx already proved the data path.

## D-022

- Date: 2026-07-31
- Status: Closed
- Decision: With the operator present and driving, `writeExclusion` was
  deliberately lifted for exactly one wireless page/field —
  `wpsPage`'s `wps_enable` — as the first supervised live write-path test
  in the wireless category. Chosen specifically because it cannot affect
  SSID, security, or channel, so existing client connections were never
  at risk from a wrong value, only from the (expected, native-matching)
  `restart_wireless` reassociation blip. The operator submitted both
  directions (1→0, then 0→1) via their own click in the extension's
  normal UI; the assistant never submitted a write itself, per the
  project's standing "no write of any kind by the agent" boundary — it
  prepared the code change, explained the exact payload in advance, and
  observed/verified alongside the operator. Both submissions independently
  confirmed by live nvram re-read, and the expected client-reassociation
  side effect was operator-confirmed to match native behavior exactly.
  Full record: `docs/WRITE_PATH_CHARACTERIZATION.md` §4.
- Rationale: this both closes a small piece of the "48 of 49 write paths
  never live-submitted" gap and, more importantly, validates the
  project's core write mechanism end to end against real hardware for
  the first time outside the original Tweaks session: the
  applyapp.cgi-delta-write architecture, the write guard, and the
  verifyNvram confirmation logic all behaved exactly as designed.
  `wpsPage.confidence.write` intentionally stays `'unverified-write'`
  rather than being marked fully verified — `wps_band_x` was never
  tested, and page-level confidence has no per-field granularity in this
  codebase's type system, so claiming the whole page would overstate
  coverage. Every other wireless page keeps its exclusion; this is not a
  precedent for lifting them without the same live, supervised process
  per page.

## D-023

- Date: 2026-07-31
- Status: Closed
- Decision: Operator asked why the WPS page doesn't show a toggle per
  wireless band. Checked native firmware first rather than redesigning
  blind: `Advanced_WWPS_Content.asp`'s `get_band_str()`/`SelectBand()`/
  `initial()` confirm WPS has no per-band enable state anywhere — one
  global `wps_enable` flag plus one `wps_band_x` "which band pairs
  next" picker. WSC pairing is a single state machine targeting one
  radio at a time; per-band toggles would misrepresent hardware that
  cannot run simultaneous per-band pairing sessions. Implemented instead:
  relabeled the field "WPS target band" with a hint explaining the
  single-band model (addresses the actual confusion behind the
  request), and fixed a real, independently-discovered gap while
  reading the source — native offers a third "5 GHz-2" option on
  tri-band hardware with two 5 GHz radios and no 6 GHz radio
  (`wl_info.band5g_2_support`, e.g. RT-AC3200-class), mutually exclusive
  with the `band6g_support` units (like the operator's RT-BE92U) this
  project has actually tested. `FieldOption` gained an optional
  `gate?: (caps) => boolean` predicate, mirroring the one
  `InstanceSelector` options already had; `SettingsPage.tsx` threads
  `caps` into `FieldControl` and filters both `radio` and `select`
  options by it — a general mechanism, not a WPS-specific hack, so any
  future field with hardware-conditional options can reuse it.
- Rationale: the request, taken literally, would have shipped a UI that
  implied a capability the hardware doesn't have. Reading the native
  source first caught that before any code was written. The band5g_2
  fix is structural only — no unit with that flag has been live-tested
  — and the "5 GHz" vs "5 GHz-1" label distinction native makes on that
  hardware is deliberately not replicated (no per-option conditional
  label mechanism existed or was worth building for this one cosmetic
  case); documented inline as an accepted, low-cost imprecision, not a
  value/write-path bug.

## D-024

- Date: 2026-07-31
- Status: Closed
- Decision: Replaced the indeterminate spinner shown during a write's
  settle+verify wait with a mechanical progress indicator, per explicit
  operator request ("not a copy of the native ASUS loading circle...
  something a technical user would appreciate — phase, numbers, an
  actually moving bar"). `verifyNvram()` gained an optional `onProgress`
  hook (`settle-start` / `poll-attempt` / `complete` events);
  `guardedWrite()` threads it through and adds its own `submitting`
  event. Both default to a no-op, preserving the two existing two-arg
  call sites (`wol.tsx`, `site-survey.tsx`) unchanged — confirmed by
  `tsc`. A pure reducer (`applyProgressReducer`) folds the event stream
  into phase/attempt/elapsed state for a new `<ApplyProgress>`
  component: phase label plus a real bar keyed to elapsed/ceiling,
  Fujin-token-styled, no spinner. `SettingsPage.tsx` covers the one
  case `guardedWrite` can't signal through the normal event stream —
  `submitBuiltWrite` throwing before `verifyNvram` ever runs — by
  synthesizing a `failed` state directly from `entry.error`.
- Rationale: purely additive, UI-only, no write-path/safety-mechanism
  change of any kind — the underlying settle/poll/verify logic in
  `verifyNvram` is untouched except for event emission at existing
  control-flow points (every prior `return result(...)` now routes
  through a `finish()` wrapper that also fires exactly one `complete`
  event; verified by grep that no call site bypasses it). Live-verified
  in the fixture harness via a new opt-in `?slowwrite=1` mode (delays
  mock `applyapp.cgi` writes so the poll loop is actually observable,
  not just theorized): settle countdown ticked `0.0s→5.0s` with a
  matching fill percentage, verify attempts advanced `1→8` with
  elapsed/ceiling numbers, both resolved to `VERIFIED APPLIED`; a
  cosmetic `-0.0s` glitch on the very first settle tick (two
  independent `Date.now()` calls a React tick apart) was found and
  fixed during that same verification pass, not left for later.

## D-025

- Date: 2026-07-31
- Status: Closed (selection recorded; implementation handoff built separately)
- Decision: Presented the operator a grouped, multi-select questionnaire
  covering all 13 items in OPEN_LOOPS.md's "Missing features" (deferred
  scope) list, each option carrying a value case and a deferral/risk
  rationale. The operator selected all 13: SDN profile creation/editing,
  per-user Samba/FTP permissions, OpenVPN server client list, WireGuard
  server peers, certificate/key BLOB handling, Operation Mode switching,
  Time Machine, Download Master, AiMesh node management, notification
  center, Advanced_QOSUserPrio, Dashboard dual-WAN aggregation, and a
  second WireGuard server instance. Operation Mode switching was
  explicitly flagged in its questionnaire option as the highest-risk
  item (real lockout potential — a mode switch can change how the
  router behaves on the very network the browser is talking through)
  and selected anyway, with that framing visible at selection time.
- Rationale: this is post-1.0 feature-development scope, not
  release-closing work, and was kept as a separate decision/handoff
  from the solo-completable-remainder pass (D-024 and prior) precisely
  because the two have different risk/reward shapes and timelines.
  Given the size (13 substantial features, several introducing new
  write-capable surfaces and at least one new interaction pattern this
  codebase has never needed before — file/BLOB upload for certs and
  keys), the implementation handoff
  (`.raiden/local/prompts/deferred-features-handoff.md`) is structured
  as four risk-ordered waves rather than one pass, so a future session
  can run one wave without committing to all 13 at once. Every new
  write path this work produces must inherit the project's existing
  write-safety posture from day one (`writeExclusion` set,
  `confidence.write: 'unverified-write'`) — new features are not
  exempt from the discipline every existing write path already follows.

- **Addendum (2026-07-31, same day):** the operator's follow-up
  instruction superseded this decision's original framing before the
  implementation handoff was written. See D-026 for the pass itself. Requested instead: one continuous
  Fable-orchestrated pass working through all 13 features to
  completion, with explicit emphasis on sub-delegating to whichever
  subagent types fit each piece of work, pausing only for a genuine
  critical security issue rather than for routine check-ins between
  features. `.raiden/local/prompts/deferred-features-handoff.md` was
  written to that framing directly — internal risk-ordering is kept as
  a sequencing suggestion within the single pass, not as gates between
  separately-run sessions. Absolute hard boundaries (no live router
  write ever, no writeExclusion ever lifted/weakened, no live-hardware
  verification, no store submission, no push to origin) are unchanged
  and are explicitly framed in that document as structural constraints
  on the action space, distinct from the narrower "stop the whole pass"
  condition, so the two are never conflated by a future agent reading
  it.

## D-026

- Date: 2026-07-31
- Status: Closed (implementation pass complete; live verification of every
  new write path remains operator-gated, as for every other write path in
  this project)
- Decision: Ran the single-pass, Fable-orchestrated implementation of all 13
  deferred features selected in D-025, per
  `.raiden/local/prompts/deferred-features-handoff.md`. Nine research
  subagents (one per feature domain, firmware-source only, no network) fed
  nine implementation subagents; the orchestrator reviewed every brief,
  resolved the scoping calls below, integrated the registry itself to avoid
  the shared-file tangle D-018/CURRENT_STATE record from a prior session,
  and re-ran the full verification suite against the merged tree rather
  than trusting any subagent's self-report.
- **Write-safety outcome (the load-bearing one):** every new write path
  ships with a `writeExclusion` tag and `confidence.write:
  'unverified-write'` from the moment it exists. Audited explicitly across
  every new and modified page def before the pass was called done, not
  assumed. No existing exclusion was lifted, weakened, or questioned. No
  write of any kind was submitted to any router by the orchestrator or any
  subagent, in any category, at any point.
- Scoping calls made by the orchestrator, each a judgment the handoff
  delegated rather than a boundary crossing:
  - **SDN profile CRUD → `writeExclusion: 'wireless'`** (hard-blocked).
    Native's Apply is a whole-table rewrite of five rule lists, and the
    main network's real broadcast SSID/passphrase live in the sibling
    `apm{idx}_*` family that a misrouted write could clobber. Beyond the
    hard block, the implementation carries two independent structural
    refusals: guest-class assertion before any mutation is computed, and a
    payload-level throw if an `apm` key ever appears. Guest/IoT profiles
    only; VLAN-trunk/port-binding excluded specifically to avoid native's
    `restart_net_and_phy` escalation path.
  - **Operation Mode → `'wan'`, and NO write block at all.** The mode→key
    matrix is documented in full with citations, but native routes most
    transitions through the QIS wizard, which posts a chip-family- and
    runtime-conditional key superset not fully derivable from the vendored
    source. On the one page whose failure mode is losing contact with the
    device, a probably-complete write is the wrong trade — the matrix is
    recorded for a future supervised session instead of half-implemented.
    The page still carries the tag and confidence tier so diagnostics
    bucket it with the hard-excluded WAN-role surface. AiMesh-node mode is
    absent entirely: no nvram write path for it exists in source; native
    reaches it via a confirm-gated restore-to-defaults + re-onboard flow.
  - **AiMesh → `'firmware-reboot-reset'`.** The research recommended
    inventing a new `aimesh-topology` category; overruled in favor of the
    closest existing one, since the shipped actions are node reboot and the
    deferred ones are factory-reset class, and a new category would carry
    identical interlock semantics. Flagged for operator review as a
    taxonomy question. The empty-target variants of `device_reboot` and
    `config_changed` — which reboot or reconfigure the ENTIRE mesh — are
    structurally unconstructible from this UI, not merely unexposed.
  - **Notification mark-read → `null`.** `action_mode=nt_apply`'s `write`
    and `readall` branches touch only the closed-source event-log DB and
    issue no `notify_rc` (web.c:13989-14082) — same risk tier as a UI
    preference toggle. `delete`/`delete_all` (the latter unlinks the whole
    DB, with no native UI behind it) and `nc_setting_conf` editing are not
    built. The notification "Block device" shortcut was identified as a
    wireless ACL write in a notification-center costume and excluded on
    those grounds.
  - **QoS/USB/Time Machine → `null`,** matching their existing sibling
    defs' reviewed convention rather than inventing per-page policy.
- Two features closed short of their full scope, both for specific
  documented reasons rather than scope exhaustion:
  - **Certificate/key BLOB upload not built.** Discovered while
    implementing: the write chokepoint's request body is typed `string` and
    is echoed to both the console and the Diagnostics write inspector on
    every submit. Routing real cert/key uploads through it as it stands
    would place private key material into the write log. Widening it
    requires redaction at construction time — a change to shared
    write-path infrastructure that deserves its own reviewed pass, not a
    ride-along in a feature commit. Read surfaces (presence/metadata only,
    never key content) and OpenVPN paste-replace editing did ship. See
    OPEN_LOOPS for the follow-up.
  - **Per-user Samba/FTP permissions shipped read-only.** The six
    `/aidisk/*.asp` account endpoints are dedicated CGI POSTs outside the
    extension's `WriteEndpoint` vocabulary (`applyapp` | `start_apply`);
    building them means extending the same shared write chokepoint as
    above, and the create/modify params carry account passwords, which
    compounds the logging concern. Separately worth recording: the
    orchestrator's attempt to delegate that chokepoint extension was
    refused by the environment's own permission classifier. That refusal
    was not worked around — the feature was narrowed to a viewer instead.
- Rationale: the pass was authorized to run to completion without check-ins,
  pausing only for a genuine critical security issue. None occurred. The
  chokepoint-logging finding above is a real privacy sharp edge worth
  fixing, but it is pre-existing, deliberate, session-scoped behavior on a
  write path that has always carried non-secret nvram scalars — not an
  exploitable vulnerability, and specifically not the "credential exposed
  where it shouldn't be" trigger, since no cert/key upload path was ever
  built to feed it. Logged as an open loop rather than treated as a halt
  condition.

## D-027

- Date: 2026-07-31
- Status: Closed (fix shipped, `b155fa0`)
- Decision: Mid-pass, the operator directed that the extension be
  privacy-first from the ground up — no remote services, code open and clear
  about what it does, and any latent privacy issue fixed immediately rather
  than carried. This superseded D-026's original disposition of the
  write-log finding (which had deferred the fix to a separate reviewed
  pass). The fix shipped the same session, implemented by the orchestrator
  directly rather than delegated, since it touches the write chokepoint:
  redaction at construction time. `WriteSpec.sensitiveKeys` names
  secret-bearing posted fields; `buildWriteRequest` derives a redacted body
  from the same parameter walk as the real one; `guardedWrite` retains ONLY
  the redacted view in its log entry (the real body exists solely inside
  the submit call frame); verify detail gets the same treatment both in the
  retained entry and in `verifyNvram`'s own console warning, which was
  found to also leak expected/actual values during this fix and closed in
  the same commit. Sources of truth: `control: 'password'` fields are
  collected automatically; composite carriers (OpenVPN/PPTP clientlists,
  both IPSec client-list shards and both profile strings, SDN's
  `apg{idx}_security`, the certificate pages' pasted material) are marked
  per def. Nothing about what is SUBMITTED changed — this is entirely about
  what is recorded and displayed.
- Also re-verified as part of the same directive: the shipped source
  contains no remote endpoint of any kind — the only absolute URLs in
  `src/` are the content-script match patterns for `router.asus.com`, the
  router's own local hostname alias. Every fetch is same-origin against the
  configured router address, consistent with docs/privacy-policy.md.
- Follow-up left open (OPEN_LOOPS): the WireGuard pages display private-key
  values on screen as readonly fields, matching native behavior — on-screen
  display is native parity and arguably necessary UX (peer setup requires
  copying them), but a masked-with-reveal treatment would be strictly
  better; flagged for an operator UX decision, not silently changed.

## D-028

- Date: 2026-07-31
- Status: Closed (source acquired; five source-blocked questions resolved
  or substantially narrowed; docs updated)
- Decision: Acquired the firmware `rc/` init-script package — the one GPL
  component missing from every previously-vendored tree (`httpd/`+`shared/`
  +`www/` only), and the root cause of most "blocked, source unavailable"
  entries across this project's history. Fetched for BOTH active
  generations, version-matched to the vendored trees: `RAW/merlin-rc` at
  tag `3006.102.7_2` (154 source files) and `RAW/merlin-3004-rc` at tag
  `3004.388.11` (131). Source-only — the per-model `rc/prebuild/**/*.o`
  binaries were excluded as pure "every-router" bloat with no source value.
  Both are sparse partial clones of `RMerl/asuswrt-merlin.ng`; `RAW/` is
  gitignored, so no repo impact. This was operator-approved as the
  highest-value next step: it targeted the missing PACKAGE (rc), not model
  breadth, on the reasoning that per-model variance is mostly runtime
  capability flags the extension already handles, whereas the rc gap blocked
  named correctness questions.
- Acquisition method (recorded for reuse — it fought Windows/partial-clone
  friction): `git clone --filter=blob:none --no-checkout --depth 1 --branch
  <tag>`, then — because (a) a full-tree checkout aborts on Windows-illegal
  colon-paths under `udev/test/sys/devices/pci0000:00/...`, and (b) the
  partial-clone lazy blob fetch does NOT fire on `git checkout -- pathspec`
  in this Git-for-Windows build — resolve the annotated tag to its commit,
  force-fetch the rc source blobs by piping the tree's blob OIDs
  (`git ls-tree -r <commit> <rc> | grep -v /prebuild/ | awk '{print $3}'`)
  through `git cat-file --batch-check` (which DOES trigger the promisor),
  then `git checkout <commit> -- <rc> ':(exclude)<rc>/prebuild'`. Do these
  ONE repo at a time (concurrent runs collide on `.git/index.lock`).
- Findings (full writeup: `docs/RC_SOURCE_FINDINGS.md`), each closing or
  narrowing a standing gap:
  1. **VPN stop-vs-restart** (closes OPEN_LOOPS "rc daemon stop-vs-restart"):
     PPTP `start_pptpd()` and IPsec `rc_ipsec_set()` both self-gate on the
     enable flag, so restart-while-disabled ends stopped — the old static
     approach was harmless at the daemon level for those two; OpenVPN's
     internal check stays in prebuilt `libovpn.so` but native never
     restarts-to-disable, so the D-010 fix matches native regardless.
  2. **WireGuard unit 2 + peer keygen** (retires two "UNCONFIRMED" caveats
     in `vpn-server.ts`): unit 2 is a genuine functional instance at the rc
     level (`start_wgs(unit)` fully parametrized, `restart_wgs 2` works), and
     peer keypairs are generated automatically in rc (`wg genkey/pubkey/
     genpsk`, idempotent) — NOT a client/native-UI responsibility. The
     shipped second-instance and peer features are confirmed correct as
     built. Header comments corrected in this pass.
  3. **Download Master** (confirms read-only, adds a hazard): `apps_action`
     flows into the `rc_service` mini-language, which `handle_notifications()`
     splits on `;` before argv, gated only by the still-closed-source
     `check_cmd_whitelist()`. That is a genuine `;`-injection primitive.
     Verdict: stay read-only; and any FUTURE guarded dedicated-CGI write
     path must itself sanitize `;` in rc_service-bound values rather than
     trust the firmware gate (recorded as a hard constraint on the
     guarded-CGI-extension open loop). This is a firmware-side property,
     not a defect in this extension (which has no DM write path) — NOT a
     §3 halt condition; the conservative outcome it argues for is the one
     already shipped.
  4. **SDN internals** (validates the shipped SDN design): `restart_sdn`/
     `sdn_del` never touch radios directly and `restart_wireless` never
     escalates to `reboot()`; the `nvram_modified_sdn` sync gap is a no-op
     for the CRUD endpoints; MAINFH has NO server-side guard (client-JS
     only) — validating this project's structural `apm`/MAINFH refusal. 3004
     has no SDN at all (legacy per-band VIF model) — a cross-generation fact
     for a future compatibility matrix.
  5. **Time Machine / Notification / accounts:** TM `find_mountpoint()`
     builds `/tmp/mnt/<tm_device_name>` with no traversal guard in shipped
     source — but the extension's existing `^[a-zA-Z0-9]*$` field validation
     already makes a traversal payload unconstructible; elevated to a
     documented security boundary inline (doc-only, no functional change
     needed). Notification mark-read confirmed to never reach rc at all
     (validates its `writeExclusion: null`). Account write helpers confirmed
     closed-source across the whole tree (sharpens the deferred-account
     write loop: must use the firmware CGI, not raw `acc_list`).
- Rationale: this pass produced no code behavior change (one security-margin
  doc elevation on an already-safe field; several header caveats corrected
  from UNCONFIRMED to confirmed). Its value is closing the largest remaining
  class of source-blocked questions with primary-source evidence, matching
  this project's standing rigor for write-path characterization. The `rc/`
  trees remain available in `RAW/` for future rc-layer questions.
