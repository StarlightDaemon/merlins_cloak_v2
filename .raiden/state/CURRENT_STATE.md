# Current State

**Branch:** main
**Push status:** local `main` is AHEAD of `origin/main` by 19 commits —
the 2026-07-29 research/docs commits, the whole 2026-07-31 1.0-readiness
pass + live-write session, and the 2026-08-01 Tier 1/Tier 2 session are
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

## This Session (2026-08-01, latest) — Tier 1 UI + Tier 2 SDN research session

Ran the open-loop continuation handoff. First act: operator re-armed the
read-only interlock (verified by the header badge) — it stays ON. No live
writes this session; every router interaction was read-only. Nine
commits, all local, **nothing pushed** (now 19 unpushed on `main`).

Tier 1 (operator chose "Tier 1 in order"; all four decisions answered in
chat, all recommendations accepted):
- **Router Status label-left/value-right rows** (`9bcaf8e`) + operator-
  approved generalization to the Extension identity card and all four
  Sysinfo cards, retiring the `mc-kv` grid entirely (`3a9feae`). Per-row
  flex-wrap honors the atomic-token overflow criterion at every width
  (harness-verified to 300px with a live-shaped 3-address DNS list).
- **`wl{p}_ssid` hidden on SDN units + capability-aware intro banners**
  (`a19a677`) — D-031 residual; intro function form now receives caps.
- **Clear-to-empty affordance** (`a0dbc07`) — closes the revert-to-empty
  gap from D-030: explicit Clear marks empty as intended (validation-
  exempt, posted as explicit empty, verified as ""); pristine-unset
  required fields no longer block unrelated edits; backspace-to-empty
  still errors. Dry-run confirmed `wgs_addr=` in the payload.
- **Credential masking, D-032** (`4831c92`) — masked-with-reveal chosen
  over native parity: WG private keys/PSKs render as fixed dots with
  Reveal + copy-while-masked (public keys stay visible); OpenVPN/PPTP
  password list columns get per-cell Show/Hide; password controls get a
  Show toggle. Display-only; D-027 redaction untouched.

Tier 2 (two parallel read-only research agents over RAW/merlin +
RAW/merlin-rc, then a three-lens adversarial verification pass; D-033):
- **Three SDN list keys** (`1a5a043`): vlan_trunklist round-trips
  verbatim on create/edit; dhcpres{N}_rl/dot{N}_rl (per-profile side
  tables keyed by subnet_idx) stay omitted on edit, blanked on delete.
- **rc_service computed from the profile** (`bfa8a1b`): the
  restart_stubby trigger is `support_adguard_dns && subnet_idx>0` — NOT
  dot_enable as §9.4 hypothesized; gate reads native's own
  get_ui_support() hook. Derived rule reproduces the live capture
  byte-for-byte.
- **Adversarial-pass fixes** (`043ff06`): delete now REFUSES native's
  delete-side restart_net_and_phy escalation states (any non-empty
  vlan_trunklist, port-bound dut_list) instead of pairing a repaired
  table with an un-escalated rc string; create rc is the bare base; edit
  qos rule gained its bw_limit half (+ qos_enable/qos_type keys); the
  invented delete-stubby subnet term dropped; sw-mode gate corrected
  (WISP keeps sw_mode 1; mlo_rp is the real exclusion); Gaming deletes
  refuse. All SDN writes remain hard-excluded ('wireless').

Open ends: LIVE_PROBE §9.4's `dot_enable=1` note contradicts source
analysis — needs one read-only fetch of subnet_rl field 19 + dot1_rl,
blocked at session end on the operator's router login (Chrome restart
logged them out; claude-in-chrome reconnected but the httpd session is
gone). Tier 3 candidates (restart_wgs-on-running-interface, further
wireless lifts) untouched — need the operator live.

## Prior Session (2026-07-31) — operator-present live write session

Ran `.raiden/local/prompts/live-write-verification-handoff.md` to
completion: **all three ranked candidates closed**, plus six UI/UX fixes
that came out of the operator watching their own live data. First session
with full browser-automation tooling (Claude-in-Chrome) — which changed
nothing about the standing rule: **every write was submitted by the
operator's own click or console paste**; the assistant navigated, read,
and verified only. Read-only mode was operator-disabled only for the two
write tests. Seven commits, all local, **nothing pushed**.

Live write tests (each: baseline → operator submits → forced-fresh nvram
verify → revert → verify → connectivity check):
- **`wps_band_x` both directions** (D-029, `2e3f9a7`) — 0→1→0, delta held
  (`wps_enable` never posted), `uptime()` continuity across both submits
  proved `restart_wireless` never reboots (the operator's "everything
  restarted" was client-side reassociation). `wpsPage.confidence.write`
  → `'live-verified'`: first page beyond Tweaks fully exercised.
- **WireGuard `wgs_addr`/`wgs_port`** (D-030, `8e63a95`) — `writeExclusion:
  'vpn'` lifted for the WireGuard Server page ONLY, after an in-the-moment
  D-022-style conversation where the operator chose the narrowest of three
  offered scopes. Values confirmed landing in `wgs1_*` through the
  `wgs_unit` redirect and clearing back to empty — **the nvram-landing
  half of the CRITICAL D-008 finding is now closed live on deployed
  firmware**, not just source-verified. No keygen (server never enabled,
  `restart_wgs` self-gated as rc source predicted); operator's active WG
  *client* untouched throughout. Still open by operator choice:
  restart_wgs-applies-to-running-interface.
- **SDN SSID key family** (D-031, `04a9182`) — observation-only, with the
  extension **disabled** so native's own SDN.asp ran unmodified: native
  posts `apg{idx}_ssid`, never `wl{p}_ssid`, killing the band-role-token
  hypothesis and closing a loop open since D-021. Two new gaps filed
  (three list keys we omit; a richer rc_service incl. `restart_stubby`).

UI/UX shipped from live observation:
- **apm/apg SSID defect fixed** (`1da9f47`) — live data caught the
  Dashboard's "Main" row rendering the *guest* SSID: MAINFH/MAINBH fields
  live under `apm{idx}_*` and the two pools' idx spaces overlap. Fixture
  now mirrors the collision so a regression is visible.
- SDN page grouped Main / Guest & IoT / System records (`5ec989d`), with
  a source-grounded note that the AiMesh backhaul is not client-joinable;
  DEFAULT row's meaningless Edit/Delete buttons removed.
- SSID-first naming; `LEGACY` no longer mislabeled "Legacy guest"
  (`889242f`) — the operator's IoT network read as "legacy"; firmware
  types ANY all-nodes-synced profile `LEGACY` regardless of wizard
  (sdn.js:3630), so the SSID is the only purpose record.
- Instance-gated intro banners (`21b1208`) — new `intro` function form;
  WG Server 2's wall of text now a 380-char warn summary shown only on
  Server 2.
- `wlnband_list` live-confirmed (`8083136`), settling the wl0/1/2 band
  order caveat for this hardware class.

New loops filed: revert-to-empty UI gap (required validation makes
clearing a field impossible in-UI — the WG revert needed a console
paste), Router Status label-left/value-right layout, and the two SDN
payload gaps above.

**Privacy note carried forward:** two of the operator's WPA passphrases
passed through this session's context (read as part of the composite
`apg{idx}_security` key — once while probing structure, once inside the
captured native payload). No credential value was written to any file,
commit, or state doc; the capture buffer was cleared. The operator was
told both times; rotation is their call.

## This Session (2026-07-31, earlier) — rc-source acquisition + research

Operator-approved follow-up to the deferred-features pass. Acquired the
firmware `rc/` init-script package — long missing from `RAW/`, the cause of
most "blocked, source unavailable" gaps — for both generations
(`RAW/merlin-rc` @ 3006.102.7_2, `RAW/merlin-3004-rc` @ 3004.388.11,
source-only, gitignored). Five read-only research agents closed/narrowed the
standing rc-layer questions (DECISIONS D-028; `docs/RC_SOURCE_FINDINGS.md`):

- VPN stop-vs-restart: PPTP/IPsec daemons self-gate → old static approach
  harmless at daemon level; D-010 fix matches native regardless. Loop
  RESOLVED from source.
- WireGuard: unit 2 is genuinely functional at rc level and peer keygen is
  automatic in rc — the shipped second-instance and peer features are
  confirmed correct; two "UNCONFIRMED" header caveats corrected.
- Download Master: confirmed read-only; found a `;`-injection primitive in
  the `rc_service` mini-language → hard sanitization constraint recorded on
  the guarded-CGI-extension loop (firmware-side property, not our defect).
- SDN: no reboot escalation, MAINFH has no server-side guard (client-JS
  only) → validates the extension's structural MAINFH/apm refusal; 3004 has
  no SDN.
- Time Machine: firmware has no path-traversal guard, but the extension's
  existing charset validation already blocks it — elevated to a documented
  security boundary (doc-only).

No code behavior change; header caveats corrected, one security-margin doc
elevation, state docs updated. `rc/` trees remain in `RAW/` for future use.

## This Session (2026-07-31, later) — deferred-features pass (all 13)

Orchestrated single pass per the D-025 handoff: 9 research + 10
implementation/verification subagents, orchestrator-integrated. All 13
features shipped or precisely scoped (D-026); tsc/lint/audit/builds all
clean at the final commit; everything local, nothing pushed. Headlines:

- Ten new views, four extended (73 → 83). Every new write path born with
  `writeExclusion` + `confidence.write: 'unverified-write'` — audited
  explicitly, none ever live-submitted.
- Highest-stakes calls: SDN CRUD under 'wireless' hard block with
  structural apm/MAINFH refusals; Operation Mode read-only with the full
  write matrix documented instead of a possibly-incomplete write block;
  AiMesh whole-mesh empty-target actions made unconstructible.
- **Privacy fix mid-pass (operator-directed, D-027, `b155fa0`):** secrets
  are redacted at write-request construction; nothing secret can reach the
  console log, diagnostics write inspector, or retained verify detail.
  Re-verified zero remote endpoints in `src/`.
- Fixture harness covers all 12 new/changed surfaces, screenshot-verified.
- New follow-up loops in OPEN_LOOPS: guarded dedicated-CGI chokepoint
  extension (reserved for operator review), WG key display UX, opmode
  write construction (supervised only), SDN cp{idx} classification.

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

## This Session (2026-07-31, continued) — interactive live test + 2 UI features

Direct continuation of the pass above, operator-driven and interactive
rather than orchestrated. All work committed locally on `main`; **nothing
pushed**. `tsc`/lint/`npm audit`/both builds re-verified clean after each
commit.

- **First wireless write-path live verification** (D-022): `wps_enable`
  submitted both directions by the operator's own click against the
  RT-BE92U, each confirmed by live nvram re-read; confirms the
  `applyapp.cgi` delta-write + write-guard + `verifyNvram` mechanism end
  to end against real hardware, not just the original Tweaks session.
  `wps_band_x` and every other wireless page remain untested and
  excluded — this was one field on one page, not a category-wide
  unlock.
- **WPS band picker fixed** (D-023): operator asked why WPS doesn't show
  a per-band toggle; checked native firmware first rather than building
  blind — WPS genuinely has no per-band enable, confirmed from source.
  Relabeled the field with an explanatory hint instead, and fixed a real
  gap the source-check surfaced: a missing "5 GHz-2" option for
  dual-5GHz tri-band hardware (untested, structural only). Added a
  reusable per-option capability gate (`FieldOption.gate`) generalizing
  the pattern the band-instance selector already used.
- **Mechanical write-progress indicator shipped** (D-024): replaced the
  indeterminate spinner during a write's wait with a phase-labeled,
  real progress bar (elapsed/ceiling numbers), per explicit operator
  request for something "technically mechanical," not a copy of native
  ASUS's loading circle. Purely additive to `verifyNvram`/`guardedWrite`
  (optional progress hook, defaults to no-op); live-verified in the
  fixture harness with a new `?slowwrite=1` mode, including a found-and-
  fixed cosmetic timing glitch.
- Mid-session git hygiene note: two features landed in the same shared
  files (`SettingsPage.tsx`, `types.ts`) from concurrent work in the
  same tree (no worktree isolation for this interactive stretch, unlike
  the orchestrated pass). Split cleanly into two atomic commits via a
  reconstruct-and-diff maneuver (apply one feature's edits onto the
  HEAD baseline in isolation, stage that, then restore the full working
  file) rather than committing them tangled together — no work lost,
  no hunks misattributed.

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
