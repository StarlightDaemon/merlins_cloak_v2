# Build Status — Merlin's Cloak v2

Session of 2026-07-24 (resumed once after a mid-session usage-limit
interruption; no disk work lost). This document is the resumable state of
record. See git log for the commit trail.

## Session of 2026-07-31 — deferred-features pass (orchestrated, all 13 items)

The single-pass implementation of every deferred feature selected in D-025,
run per `.raiden/local/prompts/deferred-features-handoff.md`. Nine
firmware-source research agents fed nine implementation agents plus a
dedicated harness-verification agent; the orchestrator reviewed every brief,
made the scoping calls (D-026), integrated the page registry itself, and
re-verified the merged tree. Verification at the final commit:
`npx tsc --noEmit` clean, `npm run lint` clean, `npm audit` 0
vulnerabilities, Chrome MV3 + Firefox MV3 builds both pass and are current
in `.output/`. All commits local, nothing pushed.

- **Shipped in full (read + structurally-excluded write, harness-verified):**
  QOSUserPrio (`0ad7090`), Notification Center incl. guarded mark-read
  (`eede3f3`), SDN guest-profile create/edit/delete under the 'wireless'
  hard block with apm-family structural refusals (`c788744`), Time Machine
  (`7551915`), AiMesh node management — reboot/LED/alias per node, whole-mesh
  empty-target variants unconstructible (`f76cb6c`), OpenVPN
  username/password client list (settled: genuinely shared across both
  units), WireGuard server peers (peer-slot instance selector over the
  wgsc_* redirect), second WireGuard server instance (`0000512`), VPN + 
  router-HTTPS certificate pages — presence/metadata reads, OpenVPN
  paste-replace write, never any key material rendered or logged
  (`6060d5f`).
- **Shipped read-only, by design:** dual-WAN Dashboard aggregation
  (`c125776`); Download Master status (write path is a closed-source-gated
  dedicated CGI; `7551915`); USB share accounts & permissions viewer
  (`97f1d5f`); Operation Mode (`697367d`) — current-mode derivation incl.
  the WISP sw_mode nuance, with the full mode→key write matrix and
  reachability-risk record documented for a future supervised session
  instead of a possibly-incomplete write block (deliberate; see D-026).
- **Privacy fix, operator-directed mid-pass (`b155fa0`, D-027):** secrets
  (passwords, PSKs, pasted key material) are now redacted at request
  construction and never enter the console log, the diagnostics write
  inspector, or retained verify detail — including on dry-runs. Submitted
  requests are unchanged. Also re-verified: no remote endpoints anywhere in
  `src/` (all traffic is same-origin against the configured router).
- **Write-safety audit (explicit, §Definition-of-Done):** every new write
  path carries `writeExclusion` (incl. deliberate, documented `null`s) and
  `confidence.write: 'unverified-write'`. No existing exclusion touched. No
  write submitted to any router by any agent at any point.
- **Harness:** all new/changed surfaces rendered against fictional fixtures
  and screenshot-verified — 12 in `e2a4e1e` (single-WAN dashboard default
  confirmed byte-identical), plus the final two in `116455b`
  (`usb-accounts` with three degradation variants, and `openvpn-server`
  with both instances). Those two were built concurrently with the first
  harness round and so had been missed by it; a completeness sweep against
  the page registry caught them.
- Surface count: ten new views registered (qos-userprio,
  notification-center, aimesh, timemachine, download-master, usb-accounts,
  wireguard-server-peers, opmode, router-cert, vpn-certs), four existing
  views extended (dashboard, sdn, openvpn-server, wireguard-server) —
  73 → 83 views. The Diagnostics confidence table remains the authoritative
  per-page verification state.

## Session of 2026-07-31 — 1.0-readiness pass (orchestrated, multi-agent)

Every solo-completable 1.0 item closed; what remains is operator-gated
live verification only. All commits local, unpushed. Verification state
at the final commit: `npx tsc --noEmit` clean, `npx eslint .` clean,
`npm audit` **0 vulnerabilities**, Chrome MV3 and Firefox MV3 builds both
pass and are current in `.output/`.

- **Dependencies:** eslint 9→10, wxt 0.20→0.21, typescript-eslint 8.65;
  `eslint-plugin-react` removed entirely — it contributed zero active
  rules and its nested minimatch chain had no safe override (D-019).
  wxt 0.21 knock-on: `noUncheckedIndexedAccess` explicitly set false in
  the root tsconfig. `RAW/` added to eslint ignores.
- **Popup on real Fujin tokens** (`4c5447b`): shared resolution in
  `src/theme/vars.ts`; dark-only, blue accent, 0px radii. Verified in
  the fixture harness and confirmed live by the operator.
- **Screenshot fixture harness** (`tools/screenshot-harness/`) + four
  1280×800 store screenshots (`docs/store-assets/`), fictional data
  only, captured via headless Chrome. Store listing asset-complete;
  promo tiles/account/submission remain operator-only.
- **Secret scan closed:** gitleaks 8.30.1 full-history (88 commits, 6
  false positives — nvram key-name literals) + trufflehog regex (0).
- **VPN write-path correctness (code-level, live verification pending):**
  `ipsec_profile_2` regenerated in lockstep with profile_1 (`d8ca9ff`,
  template byte-verified against .asp and both web.c skeletons;
  profile_2 confirmed a router_defaults entry at defaults.c:4628);
  OpenVPN/PPTP/IPSec rc actions branch by enable/disable direction as
  native does (`1b92640`), mooting the rc stop-vs-restart empirical
  question for this codebase. VPN writes remain hard-excluded.
- **Operator live session** (read-only, operator-authorized, driven via
  the operator's own authenticated browser; zero writes, interlock
  untouched): IPSec operator-fact resolved — no IPSec accounts
  configured, `ipsec_profile_2` staleness cosmetic for this deployment
  (D-020); extension mount, identity (227 flags), and popup restyle
  confirmed live; two UI defect classes surfaced (below).
- **Narrow-window layout fixed** (`75a1c18`, `34423f5`): fit-content
  label track, no mid-token wraps (operator's acceptance criterion:
  atomic values — IPs, versions, identifiers — never split; no stranded
  fragments), content-width container queries replace the
  viewport-width breakpoint that never fired.
- **Popup master enable/disable switch** (`a553f5f`): persisted
  `enabled` flag (default on), content script bails before takeover when
  off, router-origin-scoped tab reloads. Store listing + privacy policy
  updated to three stored values; gh-pages policy duplicate needs its
  manual sync (OPEN_LOOPS).
- **Dashboard SSID defect fixed network-centrically** (`0df9636`,
  D-021): on SDN firmware, one row per enabled network (Main/Guest/IoT)
  with its own `apg{idx}_ssid` and dut_list-decoded band badges; radio
  state kept; classic fallback preserved; parsing shared via
  `src/lib/sdn.ts`. Wireless-general's SDN SSID semantics (write path)
  explicitly deferred — OPEN_LOOPS "Wireless-general SSID semantics".
- Repo hook note: the commit-msg hook rejects Co-Authored-By trailers;
  all session commits carry the operator identity only.

Remaining open, all operator-gated: live write-path verification (47/49
pages never submitted at all — see below for the one now-partial
exception), Firefox live verification, live confirmation of the
WireGuard/IPSec/rc-branching fixes and the SDN dashboard view, Chrome
Web Store submission, push to origin, gh-pages policy sync.

## Session of 2026-07-31 (continued) — first wireless write-path live test

Interactive, operator-driven addendum to the pass above: a supervised
live write test in the wireless category, the project's most
write-cautious category (SSID/security/channel risk). Full record:
`docs/WRITE_PATH_CHARACTERIZATION.md` §4, `DECISIONS.md` D-022.

- **Scope, deliberately narrow:** `wireless.ts`'s `wpsPage`, `wps_enable`
  field only — chosen because it can't touch SSID/security/channel, so
  existing client connections were never at risk from a wrong value.
  `writeExclusion` was lifted for this one page only; every other
  wireless page (General SSID/Security, WDS, MAC Filter, RADIUS,
  Professional) keeps its exclusion, unchanged.
- **Both directions submitted by the operator's own click** (never by
  the assistant, per this project's standing "no write by the agent"
  rule) and independently confirmed by live nvram re-read:
  `wps_enable` 1→0 and 0→1, both verified.
- **Confirms the core write mechanism end to end against real hardware**
  for the first time outside the original Tweaks session: the
  `applyapp.cgi` delta-write architecture (only the changed field was
  posted, not the untouched `wps_band_x`), the write guard, and
  `verifyNvram`'s forced-fresh-read confirmation all behaved exactly as
  designed. The expected `restart_wireless` client-reassociation blip
  was operator-confirmed to match native behavior.
- **`wps_band_x` (the band selector) was not tested** — `wpsPage`'s
  `confidence.write` intentionally stays `'unverified-write'` rather
  than being marked fully verified, since page-level confidence has no
  per-field granularity in this codebase and claiming the whole page
  would overstate coverage.
- **Net change to the write-path count:** still 47 of 49 *pages* never
  submitted at all (Tweaks was the prior exception); WPS is now a
  *second*, partial exception — one of its two fields live-verified, one
  still open. Every category-wide exclusion besides this single field
  remains exactly as conservative as before.

tsc clean, lint clean (`npm run lint`), Chrome MV3 rebuilt and reloaded
by the operator for this test.

## Session of 2026-07-31 (continued) — WPS band picker fix, write-progress UI

Two further operator-driven items in the same interactive stretch, both
now fully verified and committed. Final state: `tsc` clean, lint clean,
`npm audit` 0 vulnerabilities, both Chrome MV3 and Firefox MV3 builds
current in `.output/`.

- **WPS band picker fixed** (`aaf6d3d`, D-023). Operator asked why WPS
  doesn't show a toggle per band. Checked `Advanced_WWPS_Content.asp`
  first: WPS genuinely has no per-band enable anywhere in native
  firmware — one global toggle, one "which band pairs next" picker.
  Relabeled the field "WPS target band" with a hint explaining the
  single-band model, and fixed a real gap the source-check surfaced —
  a missing "5 GHz-2" option for dual-5GHz tri-band hardware (untested,
  structural only; mutually exclusive with the operator's own
  `band6g_support` unit). Added a reusable `FieldOption.gate` predicate,
  generalizing the pattern the band-instance selector already used, so
  future fields with hardware-conditional options don't need one-off
  logic. Verified in the fixture harness: label/hint render correctly,
  gated option correctly absent under BE92U-like capabilities.
- **Mechanical write-progress indicator shipped** (`dac2b78`, D-024).
  Replaced the indeterminate spinner during a write's settle/verify
  wait with a phase-labeled, real progress bar (concrete elapsed/
  ceiling numbers, attempt counts) — explicit operator request for
  something "technically mechanical," not a copy of native ASUS's
  loading circle. `verifyNvram`/`guardedWrite` gained an optional
  progress-event hook, defaulting to a no-op so the two existing
  two-arg call sites (`wol.tsx`, `site-survey.tsx`) are unaffected —
  confirmed by `tsc`. Live-verified in the fixture harness via a new
  `?slowwrite=1` mode that makes the poll loop actually observable:
  settle countdown and verify-attempt numbers both confirmed advancing
  correctly against real timers, not just theorized; a cosmetic `-0.0s`
  glitch on the first settle tick was found and fixed in the same pass.
- Mid-session note: both features initially landed in the same shared
  files from concurrent work in the untracked main tree (this
  interactive stretch had no worktree isolation, unlike the earlier
  orchestrated pass). Split into two clean, atomic commits via a
  reconstruct-and-diff maneuver rather than committing them tangled —
  no work lost, no hunks misattributed. Consider worktree isolation for
  any future concurrent interactive work touching shared UI files.

## Session of 2026-07-25 — licensing, disclosure, versioning, end-user docs

Documentation/legal/metadata pass. No read or write logic was touched;
the only code change was an "About" card added to the existing Extension
Settings view, plus a manifest-version normalization in wxt.config.ts.

- **GPL verbatim-content audit — clean** (docs/LICENSE_AUDIT.md). src/ (50
  files, ~12.5k lines) checked against all four GPL trees still present in
  RAW/. Four mechanical passes plus manual reading of the I/O and parsing
  layers. The comment pass matched exactly one GPL line across 1,163
  candidates, and it was a row of hyphens. Recorded but non-blocking: 14
  short UI label phrases match the native wording verbatim (§3.4), and the
  base64 validation regex in vpn-client.ts is byte-identical to the one in
  Advanced_WireguardClient_Content.asp — a widely-published idiom.
- **LICENSE — MIT**, with a scope note excluding RAW/ and the ASUS/Merlin
  names and label wording the client reuses descriptively.
- **Non-affiliation disclaimer** — README section, plus an About card on
  Extension Settings (existing surface, no new UI built for it).
- **Hardware claims corrected** — README rewritten. The old one still said
  "no router UI functionality has been implemented yet". It now separates
  live-verified (RT-BE92U only) from structural-only (RT-AX88U, never
  contacted) from untested, states graceful degradation as design intent
  rather than a test result, and says ROG/GT is out of scope rather than
  merely untested. Diagnostics copy needed no correction — it never
  overstated anything.
- **Version 0.9.0-beta.1** (was the scaffold's 0.1.0). Not an RC: Firefox
  live verification and 48 of 49 write paths are known-open, not merely
  undiscovered. wxt.config.ts ships the numeric core in Chrome's manifest
  `version` plus the full string in Chrome's `version_name`; Firefox's
  version format accepts the semver pre-release directly, so its manifest
  `version` carries the full `0.9.0-beta.1` (Firefox has no `version_name`).
- **CHANGELOG.md** — whole project history with commit hashes, from the
  git log and the committed docs/ reports. No prior releases invented.
- **docs/GETTING_STARTED.md** — end-user install/config/data doc. §10
  compatibility matrix generated from the page catalog, not from memory.
- **Read-only interlock default: verified already correct**, no change
  needed. Two independent layers both default to on —
  `DEFAULT_SETTINGS.readOnlyMode = true` (settings.ts:21, merged under any
  stored partial, and the getSettings() catch path also returns it) and
  `let readOnly = true` (write-guard.ts:47).

tsc + eslint clean; Chrome MV3 and Firefox MV3 builds both pass and are
current in .output/. Push/visibility status (verified 2026-07-25): the
repository exists on GitHub at StarlightDaemon/merlins_cloak_v2 and is
**public**. origin/main is at 58a006e — the initial WXT/React scaffold plus
the five research docs under docs/, 7 commits total — and is an ancestor of
local main. All 46 commits of the extension implementation (08e0982 through
fc5bb83) are local-only and unpushed, held for operator review; local main
is 46 ahead of and 0 behind origin/main.

## Session of 2026-07-25 — nav taxonomy implemented AND live-verified

The navigation taxonomy from docs/NAV_TAXONOMY_PROPOSAL.md is fully
implemented (7 code/docs commits: proposal committed, section bands removed,
twelve-category tree with sub-headers, orphan consolidation with page-level
gates kept exactly as they were, full §3 rename sweep, NAV_ALIASES secondary
placements with alias-aware deep-link auto-expand, hover-only prior-name
tooltips, Diagnostics confidence table regrouped), plus one follow-up fix
restoring the `traffic-last24` nav label to "Last 24 hours" (the rename sweep
had dropped it, though §3 lists that page as unchanged). tsc + eslint clean;
Chrome MV3 and Firefox MV3 builds both pass and are current in .output/.

**Chrome live verification: DONE** (2026-07-25, operator-confirmed
authenticated session + freshly loaded unpacked build; observational pass
against the live RT-BE92U, read-only mode on, no writes). Confirmed:

- All 12 categories render under their new names in exact §2 order, Merlin's
  Cloak last, and the three fixed section bands are gone.
- All six sub-header categories show correctly populated sub-groups:
  Wireless 4/3, Local Network 3(+2 aliases)/3, Security 3/4(+1 alias)/5,
  VPN 1/4/4 (the one-item Overview sub-header renders as a normal
  sub-header), Traffic & Bandwidth 5/4, Administration 2/2/3.
- All three aliases appear in both homes and route to the same working page.
  A **cold load** of `Main_RouteStatus_Content.asp` opened exactly two
  categories (Local Network + Live Status & Logs) with Routing Table active
  in both — the alias-aware auto-expand works from a fresh load, not just
  in-session.
- Prior-name tooltips are hover-only and correct, including the
  disambiguation pair: IPv6 Setup → *Formerly "IPv6" under IPv6*, IPv6
  Status → *Formerly "IPv6" under System Log*; also Wi-Fi Name & Security →
  *Formerly "General" under Wireless*, and category tooltips (LAN, WAN,
  Firewall).
- **Gate-off state observed live**: `nfsd_support` is 0 on this router, so
  NFS File Sharing is hidden and USB Storage & Sharing renders normally with
  its remaining three pages.
- Diagnostics confidence table: 21 group headings in §2 order, 73 page rows,
  zero duplicated names, no "(no nav category)" fallback group; the three
  aliased pages each appear once with an "(also in nav under …)" note.
- Console clean across ~23 navigations: 46 messages, all INFO, no errors.

Firefox live verification remains NOT run (unchanged gap). Push/visibility
status (verified 2026-07-25): the GitHub repository
StarlightDaemon/merlins_cloak_v2 is **public**, and origin/main holds the
7-commit scaffold-plus-research-docs base (58a006e). The 46 commits of the
extension implementation itself, including this session's nav-taxonomy work,
have NOT been pushed and are local only, held for operator review.

Cosmetic notes (no action taken): several new names are wider than the 236px
nav and ellipsize (proposal §5.5 anticipated this); and the IPv6 Setup
tooltip reads *under IPv6* because the old category was itself named IPv6 —
accurate, if slightly redundant.

## Snapshot

- **73 views registered** (50 declarative settings pages, 23 custom React
  pages) covering **67 distinct native .asp pages**; 14 Merlin-only views.
- **46 settings-page write paths implemented** (plus WOL wake and Site Survey
  rescan actions) — **none live-submitted this session**, all routed through
  the write-guard with the read-only interlock shipping ON.
- Lint clean; **Chrome (MV3) and Firefox builds both pass**.
- **Chrome live verification: DONE** (operator loaded the unpacked build;
  observational pass against the live RT-BE92U). Verified working with live
  data and no console errors: mount/DOM-takeover, identity detection
  (RT-BE92U · 3006.102.7_2 · Merlin · ASUSWRT 5.0), read-only interlock,
  Dashboard, Clients, SDN overview, DHCP settings renderer + rule-list
  editor, General Log (8.7k lines), Realtime traffic (6 interfaces),
  Sysinfo, VPN Status, Tweaks (values match the write-characterization
  baseline exactly), Diagnostics. Capability collection now reports 227
  *_support flags via the MAIN-world scripting-API collector (green chip).
- **Firefox live verification: NOT run** — the operator did not load the
  Firefox build this session; the build itself passes. Single remaining
  verification gap.

### Findings from the live pass (all fixed in-session)
1. Chromium's extension loader rejects Unicode noncharacters in content
   scripts even when byte-valid UTF-8 (U+FFFF sort sentinel → load failure).
2. MV3 inline MAIN-world <script> injection is silently dropped on this
   firmware's pages → flag collection fell back to rc_support (90 flags,
   hiding band6g). Replaced with background scripting.executeScript
   world:'MAIN' (no router traffic from the background).
3. **wl0_ssid holds a 32-hex placeholder on SDN-managed ASUSWRT 5.0** — the
   real broadcast SSID lives in the MAINFH sdn_rl record's apg{idx}_ssid.
   Dashboard now reads it; wireless-general still edits wl-family keys
   (correct for writes per validate_instance, but display/edit semantics on
   SDN units need a supervised write session before any wireless write is
   ever cleared).
4. sysinfo hooks return literal "None" for stopped VPN/pid states, memory
   values pre-scaled in MB, and HTML entities in cpu.model.
5. dnsmasq leases use '*' for unknown hostnames.
6. The content script can be injected twice into one document
   (double-mount observed) — idempotency guard added.
7. Direct address-bar navigation to appGet.cgi bounces to the login page
   (referer-checked); the extension's same-origin XHR reads are unaffected.

## What exists (by category)

| Category | Views | Notes |
|---|---|---|
| Status | Dashboard, Clients | uptime via `uptime()` hook; clients = leases + get_wclientlist |
| Guest Network Pro | SDN overview | read-only by design; profile editing deferred |
| AiProtection | 1 | TM_EULA gate enforced (versioned values handled) |
| Parental | 1 | 4 parallel MULTIFILTER_* lists recomposed; V2 daytime tokens decoded |
| QoS | Settings, Rules, Limiter, Classification | Cake = qos_type 9; Mb↔Kb conversion mirrors native |
| Traffic | Realtime, Last24, Daily, Monthly, Settings | update.cgi hex-literal JS parsed properly |
| Wireless | General, WPS, WDS, MAC filter, RADIUS, Professional, Site Survey | per-band instance selector (wl0/1/2) |
| LAN | LAN IP, DHCP, Route, IPTV, Switch Control | |
| WAN | Internet, Dual WAN, Port Trigger, Port Forwarding, DMZ, DDNS, NAT Passthrough | wan{p} instance selector |
| IPv6 | 1 | real ipv6_service tokens (dhcp6/other/ipv6pt/flets/6to4/6in4/6rd) |
| VPN | Status, OpenVPN client+server, WireGuard client+server, PPTP, IPSec, VPN Director, VPN Fusion (read-only) | comma-list enables decomposed; IPSec profile positions passed through |
| Firewall | General+IPv4 inbound, URL filter, Keyword filter, Net services filter, IPv6 firewall | IPv6 FW merged into BasicFirewall on 3006 — modeled as own view |
| DNS Director | 1 | 6-way rulelist sharding replicated |
| Administration | System, Time/NTP, SSH, Tweaks, Security notifications, Firmware (view), Backup (view) | |
| System Log | General, Wireless, DHCP leases, IPv6, Routes, Port forwards, Connections | |
| Network Tools | Sysinfo, Analysis, Netstat, WOL | netool.cgi; actions user-initiated only |
| USB | Samba, FTP, Media server, NFS exports | share-permission subsystem out of scope |
| Extension | Diagnostics, Settings | write inspector logs every constructed request |

## Write-path posture (unchanged, load-bearing)

- Endpoint policy: **applyapp.cgi delta writes for every settings page** —
  settled from httpd source (validate_apply iterates router_defaults and sets
  only posted keys; applyapp.cgi and apply.cgi share do_apply_cgi;
  start_apply.htm's whole-form requirement is a client-side artifact of the
  native pages posting stale full forms). start_apply support remains in
  lib/router-io.ts but no def uses it.
- Instance pages post fully-prefixed keys (wl0_ssid, vpn_client1_addr…),
  accepted by validate_instance() — confirmed in web.c.
- Verification: every applied write polls forced-fresh nvram re-reads
  (verifyNvram); response bodies are never trusted.
- Hard-excluded categories are tagged per-def (`writeExclusion`) and shown in
  Diagnostics; the four Tools_OtherSettings fields remain the only
  live-verified writes (from the prior human-supervised session).
- SystemCmd actions (WOL ether-wake) use action_mode ' Refresh ' via the same
  guarded path.

## Known open items / deferred (deliberate)

1. **Live verification pass (both browsers)** — blocked on operator loading
   the unpacked builds (.output/chrome-mv3, .output/firefox-mv3).
2. Wireless band-token question: Advanced_Wireless_Content.asp's own JS posts
   band-role-token field names (2g1_*) via httpApi.nvramSet; our defs post
   canonical wl{N}_* keys, which validate_instance accepts. Confirm live
   before any wireless write is ever cleared.
3. wgs1_* (WireGuard server) direct-prefixed writes: no dedicated
   validate_instance branch was found; leap-of-faith flagged in
   vpn-server.ts.
4. ipsec_profile_2 regeneration is not reproduced (native regenerates it on
   every save); enabling IPSec via this UI won't refresh it.
5. rcService cannot branch enable→restart vs disable→stop (vpn servers,
   ipsec); static restart chosen; harmless for nvram, service state may need
   a follow-up toggle.
6. SDN profile creation/editing; per-user Samba/FTP permissions;
   OpenVPN username/password client list (vpn_serverx_clientlist);
   WireGuard server peers; certificate/key BLOBs; Operation Mode switching;
   Time Machine; Download Master; AiMesh node management; notification
   center; Advanced_QOSUserPrio (per-priority % allocation).
7. Dashboard WAN card shows wan0 only (no dual-WAN aggregation).

## Safety invariants honored

- No write submitted to the live router by the agent, in any category.
- No live verification attempted without operator confirmation; no browser
  profile/cookie/session access of any kind.
- RAW/ untouched; no live household data committed.
