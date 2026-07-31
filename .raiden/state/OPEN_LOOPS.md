# Open Loops

Each entry below is written to be picked up standalone, by an agent session
with no memory of how it got here. Grouped by track; within a track, ordered
roughly by how self-contained the work is, not by priority.

> **Source note (2026-07-31):** the firmware `rc/` init-script package —
> long absent from `RAW/` and the cause of most "blocked, source
> unavailable" entries — is now vendored for both generations
> (`RAW/merlin-rc` @ 3006.102.7_2, `RAW/merlin-3004-rc` @ 3004.388.11,
> source-only, gitignored). Findings in `docs/RC_SOURCE_FINDINGS.md`,
> acquisition in DECISIONS D-028. Still NOT vendored: `shared/` bodies for
> the 3004 tree and a handful of genuinely closed-source units (see that
> doc's "Residual unconfirmables"). Future rc-layer questions can now be
> answered from source — check there before marking anything blocked.

## Chrome Web Store readiness

### Store listing screenshots
- **Status: CLOSED 2026-07-31.** Four 1280×800 screenshots captured under
  `docs/store-assets/` (dashboard, clients, DHCP, popup) via headless
  Chrome against the new fixture harness (`tools/screenshot-harness/`,
  capture commands in its README) — fictional data only, dimensions
  verified from PNG headers, committed `72983d9` and re-captured in
  `34423f5`/`0df9636` after layout changes. The popup shot is a
  placeholder (content fills only its natural popup-sized region on a
  full-page canvas) — flagged in the listing doc; dashboard/clients/dhcp
  are store-ready. Remaining store items are operator-only: optional
  promo tiles, developer account, submission.
- **What (original):** Capture real screenshots of the extension UI for the
  Chrome Web Store listing. At least one (1280×800 or 640×400) is required;
  `docs/CHROME_STORE_LISTING.md` has the rest of the listing copy already
  drafted and notes this as the one missing asset.
- **Approach:** Build a small fixture-data harness (mock nvram/status
  values standing in for a real router) to render the popup and
  content-script UI standalone, then capture screenshots from that — not
  against a real router. Real router data should never appear in public
  screenshots regardless (it'd leak the operator's actual network
  configuration), so a mock harness is the correct approach, not a
  workaround forced by not having hardware access.
- **Blocked on:** nothing. Solo-completable.
- **Out of scope for this loop:** promotional tile images (optional, lower
  priority than the required screenshot); actual dashboard submission
  (operator-only — needs their Chrome Web Store account).

### GitHub Pages site (gh-pages branch)
- **Status:** live, not further tracked as an open loop, informational.
- **What:** a public landing page exists at
  https://starlightdaemon.github.io/merlins_cloak_v2/, served from a
  `gh-pages` branch that shares no commit history with `main`. It
  contains `index.html` and `style.css` at its root, plus
  `privacy-policy.html`, a manually maintained duplicate of
  `docs/privacy-policy.md` on `main` with no automated sync between the
  two.
- **Why this is logged here:** `main`'s state files previously had no
  record this branch or live site existed at all. Any future session
  should be aware a second branch exists before assuming `main` is the
  only relevant branch in this repository.

### Popup UI does not use Fujin tokens, unlike the content-script panel
- **Status: CLOSED 2026-07-31** (`4c5447b`). Token resolution factored
  into `src/theme/vars.ts`, shared by the shadow-root panel (`css.ts`,
  output unchanged) and a new popup `:root` injector
  (`src/theme/popup-theme.ts`); every popup color now maps to a semantic
  Fujin role, every radius to a Fujin radius token (0px per D-005).
  Visually verified in the fixture harness (computed vars resolve,
  radii 0px) and confirmed live by the operator on the RT-BE92U.
- **Status (original):** open, not yet scheduled.
- **What:** this project's content-script panel is genuinely themed via
  Fujin's design tokens, imported and resolved live. The popup UI,
  `src/entrypoints/popup/style.css` and `App.css`, is separately
  hand-rolled with its own hardcoded colors and does not follow Fujin's
  sharp-corner rule, using a 4px border-radius instead of 0px. This means
  the extension currently has two different, inconsistent visual
  identities across its two surfaces.
- **Where:** `src/entrypoints/popup/style.css`,
  `src/entrypoints/popup/App.css`, compare against `src/theme/css.ts` for
  the genuine Fujin-derived pattern.

## Write-path correctness gaps (source-research-completable)

Four items STATUS.md flags as "confirm before trusting this write path."
Each is at least partially answerable by reading the Merlin firmware GPL
source already present in `RAW/` (httpd, rc, and related C sources) — no
live router required to make progress, though live testing is still the
final word. An agent with source access can close or substantially narrow
each of these without operator involvement.

### Wireless band-token field naming
- **Status:** Closed, no risk.
- **Finding:** `validate_instance` in the firmware httpd source (web.c:3749–3753)
  only ever constructs `wl` prefixed keys indexed by unit number and performs an
  exact-match lookup against them. It never looks for band-role-token keys such
  as `2g1_` prefixed names on write. The only place the firmware maps band-role-
  token keys to `wl` prefixed keys is `ej_wl_nvram_get` (web.c:1213–1248), which
  is used solely for server-side page rendering on GET requests and is never
  called from the write path (`validate_apply` or `validate_instance` at
  web.c:13153–13195 and 4333–4335). This means the firmware write path only ever
  accepts `wl` prefixed keys, and this project posting canonical `wl` prefixed
  keys is the only format the firmware validates against, not a risky divergence
  from stock behavior.

#### Note: Client-side band-token translation (not confirmed)
Whether `Advanced_Wireless_Content.asp` translates band-token keys to `wl`
prefixed keys client-side in the browser before the POST was not confirmed during
this research. Cited but not verified: `asus.js` around line 321–374.

#### Note: Physical radio band index mapping (not confirmed)
This research did not verify which numeric unit index corresponds to which
physical radio band (2.4 GHz vs. 5 GHz vs. 5 GHz-2 vs. 6 GHz). A wrong band-to-
index mapping would be a distinct correctness issue from the key format question
closed above.

### WireGuard server (`wgs1_*`) direct-prefixed writes
- **Status:** Confirmed open, **CRITICAL** severity (raised from high — see
  "Follow-up resolved" below; this status line previously lagged that
  escalation and is corrected here for consistency).
- **Finding:** No `validate_instance` branch exists in the firmware httpd
  source for `wgs1` prefixed keys (web.c:3729–4276; zero `wgs` or
  `wireguard` references anywhere in that function). The only WireGuard
  server write handling anywhere in the write path is a redirect in
  `validate_apply` (web.c:4746–4755), which fires only on a posted literal
  unindexed `wgs_enable` field paired with a companion `wgs_unit` field,
  and internally builds the indexed `wgs{unit}_` form from that pair. It
  does not recognize an already-indexed key such as `wgs1_enable` posted
  directly, which is the form this project posts. Contrast with `wl` prefixed
  and `vpn_server` prefixed keys, both of which have genuine per-unit
  scanning branches in `validate_instance` (web.c:3749–3768 and
  4047–4058 respectively) that directly recognize the fully indexed key form
  as input. No equivalent scanning branch exists for `wgs`. All seven
  writable `wgs1` prefixed keys this project posts (`enable`, `dns`, `nat6`,
  `psk`, `alive`, `addr`, `port`) are unvalidated by this mechanism.
- **Open follow-up:** What `validate_apply` actually does with a posted key
  that matches neither a verbatim `router_defaults` entry nor any
  `validate_instance` branch is unknown. Three possible outcomes have very
  different severity: the value may be silently dropped (meaning WireGuard
  server saves currently do nothing on the wire); the value may be rejected
  with an error; or the value may be written through to nvram unconditionally
  regardless of validation (in which case whether the WireGuard rc or service
  scripts that start the tunnel actually read from that same key is a
  separate unanswered question). This must be resolved before this item is
  ready for live write-path characterization.
- **Where:** `src/pages/defs/vpn-server.ts`; firmware source in `RAW/`.
- **Follow-up resolved:** validate_apply's loop structure is table driven, not
  request driven. It contains exactly two loops, both walking the static
  router_defaults and router_state_defaults tables, at web.c around line 4316
  and 5063. get_cgi_json and validate_instance are only ever called with a
  name pulled from those tables, never with a name pulled from the posted
  request body itself. Consequence: a posted key with no verbatim defaults
  table entry, which includes all seven wgs1 prefixed keys this project
  posts, is never read out of the request body at all. It cannot reach any
  nvram_set call, cannot hit an explicit rejection path, and produces no log
  output, confirmed at web.c around line 4276 through 5234, with the relevant
  call path confirmed as applyapp.cgi through do_apply_cgi and apply_cgi with
  action_mode apply, at web.c around line 13135 through 13195, which is the
  exact path httpApi.nvramSet exercises.

  Practical consequence: WireGuard server saves posted by this project's UI
  currently do nothing on the router. The client side state updates and no
  error is thrown, so this is not visibly broken in the UI, but nothing is
  ever written to nvram. Live testing of this write path would look
  identical to a successful save. This is a functionally broken feature, not
  merely an unvalidated one.

  Severity: raise from high to critical, given this affects the core function
  of a shipped, user-facing feature, not an edge case.

- **External audit cross-check (2026-07-29):** two independent third-party
  audit reports also flagged this write path, both as Critical. A
  read-only verification pass re-derived the same conclusion directly from
  primary source rather than trusting either report or this file's own
  prior research: confirmed `router_defaults[]`'s literal entries in
  `RAW/merlin/release/src/router/shared/defaults.c` contain only unindexed
  `wgs_*` names (no `wgs1_*` entry exists anywhere in the table), and that
  `get_cgi_json()` performs a hash-keyed lookup against the parsed POST
  body — independently confirming the drop is structural. Full writeup:
  `.audits/merlins_cloak_v2_AUDIT_VERIFICATION_2026-07-29.md` §2. Decision
  record: `DECISIONS.md` D-008's verification addendum.

- **Update following D-015:** the shipped write-path fix is now confirmed
  correct at the source and control-flow level via full independent
  verification, superseding the earlier commit review's High severity
  finding about the inline comment, which has been corrected. This item
  remains open only pending live verification of two things that cannot be
  resolved from source: whether the deployed firmware matches the source
  tree this verification was performed against, and whether restart_wgs
  actually applies the redirected values to the running interface. This is
  now a Track D live-testing item, not further code or research work.

### `ipsec_profile_2` regeneration
- **Status: code fix SHIPPED 2026-07-31** (`d8ca9ff`) — `ipsec.ts` now
  regenerates `ipsec_profile_2` in lockstep with `ipsec_profile_1` on
  enabled saves, reproducing the native 43-field template byte-for-byte
  (verified against Advanced_VPN_IPSec.asp:654 and both web.c snprintf
  skeletons); `ipsec_profile_2` confirmed a literal `router_defaults`
  entry (shared/defaults.c:4628), so the applyapp write path lands it in
  nvram. Remaining: live verification only (VPN writes stay
  hard-excluded pending a supervised session). Separately, the
  operator-deployment question below resolved 2026-07-31: **zero IPSec
  client accounts configured, server off** — the staleness risk was
  cosmetic for this deployment all along; it re-arms only if IKEv2
  accounts are ever configured. Two native-side caveats documented
  inline in ipsec.ts (native's own two write paths disagree on the
  cert_address formula; the profile rebuild rides profile_1's existing
  narrower-than-native `profileTouched` trigger).
- **Status (pre-fix):** Confirmed open, **High** severity, conditional risk
  (severity confirmed by external audit cross-check, 2026-07-29 — see
  below; the conditional framing itself was unchanged and still open).
- **Finding:** Native firmware keeps ipsec_profile_1 and ipsec_profile_2 in
  lockstep, rebuilding both on every IPSec page Apply click via client side
  JS, confirmed at Advanced_VPN_IPSec.asp around line 641 through 654, and
  independently again server side in do_set_ipsec_profile_cgi at web.c around
  line 18394 through 18519. This project's UI writes ipsec_profile_1 on save
  but never touches ipsec_profile_2, so after any change to the virtual subnet
  or the DNS hostname, ipsec_profile_2 goes stale while ipsec_profile_1 updates.
  
  Downstream, ipsec_profile_2 is read by a generic profile one through five
  exclude network helper in shared misc.c around line 1213 through 1240, used
  in routing and firewall subnet exclusion, which degrades gracefully on a
  stale value. The actual strongswan or IKEv2 daemon config generator that
  would parse ipsec_profile_2's fields into a live IPSec configuration is not
  present anywhere in this repository's GPL source dump, so whether a stale
  ipsec_profile_2 actually breaks IKEv2 handshakes cannot be confirmed from
  available source.
  
  Verdict depends on a condition this research cannot answer: if no configured
  IPSec client is IKEv2 capable, meaning every account in ipsec_client_list_view
  has version 1, this is very likely safe and cosmetic. If any account is
  version 2 or version 3, this is a live risk after any subnet or hostname
  change, of unconfirmed real world severity. This project's own rcService
  trigger, ipsec_start, does fire the same as native on save, so whatever
  process consumes ipsec_profile_2 will run regardless, just against a stale
  value when the condition above is met.
  
  This question, whether any configured client is IKEv2 capable, is a fact
  about the operator's own deployment, not something resolvable from source,
  and should be confirmed before this item is prioritized.
- **Where:** IPSec fields in `src/pages/defs/ipsec.ts`; firmware source in
  `RAW/`.

External research attempted and unsuccessful: a separate web-connected
research pass was attempted to identify the process that consumes
ipsec_profile_2, since that process is absent from this repository's local
GPL source dump. It did not produce a reliable answer. One specific claim
it produced, that ipsec_profile_2 stores IKEv2 related configuration, was
sourced to an unrelated third party project and is not trustworthy as
independent confirmation, though this project's own local research already
established the same fact separately with valid citations. This external
research avenue is not recommended for reuse on this specific question
without a materially different method.

- **External audit cross-check (2026-07-29):** two independent third-party
  audit reports also flagged this staleness gap, both as High. A
  read-only verification pass confirmed High and added a nuance this
  file's prior research had not surfaced: firmware has a **second,
  dedicated** write path for IPSec profiles (`do_set_ipsec_profile_cgi`,
  reached via `set_ipsec_profile.cgi`, not the generic `applyapp.cgi` this
  project uses) that independently reconstructs *both* `ipsec_profile_1`
  and `ipsec_profile_2` server-side from raw inputs on every save — which
  would have refuted this finding entirely if this project used that
  endpoint. It does not. Also confirmed `ipsec_profile_1` (unlike
  WireGuard's `wgs1_*` keys) *is* a literal `router_defaults` entry, so
  this project's `ipsec_profile_1` write does land in nvram — this is a
  staleness gap, not a WireGuard-style silent total drop. Full writeup:
  `.audits/merlins_cloak_v2_AUDIT_VERIFICATION_2026-07-29.md` §3. Decision
  record: `DECISIONS.md` D-009's verification addendum. The IKEv2-capable-
  client conditional question below is now also logged as its own
  standalone entry — see "IPSec `ipsec_profile_2` prioritization — needs an
  operator deployment fact" later in this file.

### `rcService` restart vs. stop branching
- **Status: code fix SHIPPED 2026-07-31** (`1b92640`) —
  `WriteDef.rcService` now accepts a direction resolver, and the OpenVPN
  server, PPTP, and IPSec defs branch on the resulting enable state
  exactly as native's inline JS does (`restart_chpass;restart_vpnserver{p}`
  / `stop_vpnserver{p}`, `restart_pptpd`/`stop_pptpd`,
  `ipsec_start`/`ipsec_stop`; WireGuard stays static, matching native).
  This makes the UI match native semantics regardless of what the rc
  scripts internally do with a restart-while-disabled — the empirical
  question below is **mooted for this codebase** (it now only matters to
  native's own behavior). PPTP's conditional `;restart_samba` append is
  deliberately not reproduced (documented inline). Remaining: live
  verification only (VPN writes stay hard-excluded).
- **Status (pre-fix):** Confirmed open, split verdict by service, partially unresolved.
- **Finding:** This project always issues a single static rcService or action_script value
  regardless of enable or disable direction, for every service family.

  Native firmware behavior differs by service. WireGuard server does not
  branch either, its own submit form hardcodes the same static restart
  action regardless of direction, confirmed at
  Advanced_WireguardServer_Content.asp around line 111. For WireGuard server,
  this project's static approach matches native exactly and is harmless. Note
  this is currently moot in practice: per D-007 and D-008, WireGuard server
  writes do not reach nvram at all, so the restart mechanism being harmless
  does not matter until that write path is fixed.

  OpenVPN server, PPTP server, and IPSec all branch by direction natively.
  OpenVPN calls a restart action on enable and a separate stop action on
  disable, confirmed at Advanced_VPN_OpenVPN.asp around line 630 through 634.
  PPTP does the same, confirmed at Advanced_VPN_PPTP.asp around line 320
  through 322 and 433 through 434. IPSec does the same, confirmed at
  Advanced_VPN_IPSec.asp around line 687 through 692. For these three, this
  project's static-restart simplification is not confirmed harmless.

  The specific runtime effect of calling a restart action against nvram state
  that says disabled, meaning whether the daemon ends up still running after
  this project's disable action, cannot be confirmed because the rc script or
  daemon source that actually implements these restart and stop actions is
  absent from this repository's GPL source dump entirely, confirmed by
  directory search and by content search across all four available firmware
  dumps.

  Circumstantial evidence points toward this being a real risk rather than a
  harmless simplification: native firmware maintains separate stop actions
  for these three services specifically for the disable direction, rather
  than reusing the restart action. If restart reconciled to a stopped state
  on its own, the separate stop path would be redundant. This is evidence,
  not proof.

  The condition this verdict turns on: whether the rc scripts for OpenVPN
  server, PPTP server, and IPSec internally check their enable nvram key and
  no-op or stop when it reads disabled, which would make this harmless,
  versus unconditionally restarting the daemon regardless of the flag, which
  would leave the service running after a UI disable. This cannot be
  resolved from source available in this repository and would require either
  locating the missing rc daemon source or live testing.

- **Where:** rcService call sites in src/lib/router-io.ts, which is generic
  infrastructure only; the actual static values are declared per service in
  src/pages/defs/vpn-server.ts and src/pages/defs/ipsec.ts.

External research attempted and unsuccessful: a separate web-connected
research pass was attempted to determine the actual behavior of the
restart_vpnserverN, restart_pptpd, ipsec_start, and ipsec_stop rc actions,
since the implementing source is absent from this repository's local GPL
source dump. It did not produce a reliable answer. One specific claim from
this research must be explicitly flagged and rejected rather than treated
as unconfirmed: a claim that PPTP server support has been removed from
modern Asuswrt-Merlin branches, and that restart_pptpd was therefore
confirmed absent, was based on the research tool's own admitted inability
to fetch the file it was asked to read, substituted with fabricated
content presented as if the file had been read. This claim is discarded
entirely and must not be treated as fact. Whether PPTP server support
still exists in the target firmware remains genuinely unresolved. This
external research avenue is not recommended for reuse on this specific
question without a materially different method.

- **External audit cross-check and severity resolution (2026-07-29):** two
  independent third-party audit reports flagged this same finding but
  disagreed on severity — one rated it Medium, the other High. A read-only
  verification pass resolved this as **High for OpenVPN, PPTP, and IPSec;
  not applicable to WireGuard** (no divergence there, confirmed above),
  by independent reasoning, not by picking either report's number: the
  failure mode this gap could produce (a VPN/remote-access server the user
  explicitly disabled continuing to accept connections, with no daemon-
  status readback in this UI to contradict the nvram flag it shows) is a
  security-boundary-silently-not-enforced class of bug — High-severity on
  the cost of the failure alone; the circumstantial evidence (native
  independently maintaining this same restart/stop split across three
  unrelated subsystems) isn't weak; and this project's own risk posture
  already hard-excludes the `vpn` category pending verification, which
  would be inconsistent with rating this Medium. Not raised to Critical
  because — unlike the WireGuard finding above — this remains a genuinely
  open empirical question (see "condition this verdict turns on" above)
  rather than a source-proven failure. Full writeup and reasoning:
  `.audits/merlins_cloak_v2_AUDIT_VERIFICATION_2026-07-29.md` §4. Decision
  record: `DECISIONS.md` D-010's verification addendum. The empirical
  question itself (what the rc script for each service actually does with
  a disabled flag) is unchanged and is now additionally logged as its own
  standalone entry — see "rc daemon stop-vs-restart behavior — blocked,
  source unavailable" later in this file.

### rc daemon stop-vs-restart behavior — RESOLVED FROM SOURCE 2026-07-31
- **Status: RESOLVED** — the missing `rc/` init-script source was acquired
  this pass (`RAW/merlin-rc`, `RAW/merlin-3004-rc`; see
  `docs/RC_SOURCE_FINDINGS.md` §1 and DECISIONS D-028) and directly answers
  the question this entry was blocked on. **PPTP** (`rc/vpn.c` ~99-118):
  `start_pptpd()` self-gates on `pptpd_enable` and no-ops when off, so a
  restart-while-disabled ends stopped — the old static approach was harmless
  at the daemon level. **IPsec** (`rc/rc_ipsec.c` ~2449/2689): `rc_ipsec_set()`
  self-terminates regardless of verb, so `ipsec_restart` alone ends stopped.
  **OpenVPN**: daemon-internal check is still in prebuilt `libovpn.so`, but
  native never restarts-to-disable, so the shipped D-010 fix (`1b92640`)
  matches native regardless. No further work; retained as resolved-background.
- **Was: mooted for this codebase 2026-07-31** — since `1b92640` this
  UI issues the same direction-branched actions native does, so whatever
  the rc scripts do with a restart-while-disabled no longer affects this
  project's correctness. (The empirical question is now also answered from
  source, above, not merely mooted.)
- **Status (pre-fix):** Open, blocked. Logged as its own entry (2026-07-29) per the
  audit-verification pass's finding that this specific sub-question was
  previously only reachable as a paragraph inside the `rcService` entry
  above, not as a locatable item on its own.
- **Exactly what is unresolved:** whether the native rc actions this
  project's UI issues on save — `restart_vpnserver{p}` (OpenVPN),
  `restart_pptpd` (PPTP), `ipsec_start` (IPSec) — actually leave the
  corresponding daemon running when the nvram enable flag they'd otherwise
  read now says "disabled." Native firmware calls a *different*, dedicated
  stop action (`stop_vpnserver{p}` / `stop_pptpd` / `ipsec_stop`) on the
  disable path for all three; whether the restart action self-terminates
  the daemon anyway (harmless) or leaves it running (a real risk — see
  `rcService` entry above and `DECISIONS.md` D-010) turns entirely on this
  question.
- **Why it's blocked:** the C source that implements these rc actions is
  not `httpd`/`www` code — it lives in the router's `rc`/init-script
  package, which is absent from all four firmware trees in `RAW/`
  (`merlin`, `merlin-ax88u`, `stock`, `stock-ax88u` — confirmed by
  directory search: only `httpd`, `shared`, `www`, and, stock trees only,
  `asustools` exist under `release/src/router`; a targeted content search
  for `stop_pptpd`, `ipsec_stop`, `restart_wgs` as C function definitions,
  excluding `www/`, found nothing anywhere in `RAW/`).
- **What would close it:** either (a) locating the missing rc/init-script
  GPL source package outside this repository (Asuswrt-Merlin ships it as a
  separate release component from the `httpd`/`www` trees already
  vendored here), or (b) human-supervised live testing — disable each
  service through this UI, then check the daemon's actual running state
  and listening ports on the router directly, not just its nvram flag.
  Per operator policy this is a VPN write-path question and any live
  testing requires human presence at the router; this loop does not
  authorize or schedule that testing, only names it as the resolution
  path.
- **Where:** rc action names declared in `src/pages/defs/vpn-server.ts` and
  `src/pages/defs/ipsec.ts`; missing source would live under the router's
  `rc` package, not present in `RAW/`.

### IPSec `ipsec_profile_2` prioritization — needs an operator deployment fact
- **Status: RESOLVED 2026-07-31.** The operator fact was obtained during
  a live, read-only, operator-authorized session against the RT-BE92U:
  the IPSec VPN server is off, no pre-shared key is set, and the client
  account table is empty — **zero IPSec accounts configured**, so no
  account is IKEv2-capable and nothing on this deployment consumes
  `ipsec_profile_2`. Priority verdict: cosmetic for this deployment;
  re-arms if IPSec accounts (especially `ver` 2/3) are ever configured.
  The code gap itself was separately fixed the same day — see the
  `ipsec_profile_2` regeneration entry above.
- **Status (pre-resolution):** Open, blocked on a fact about the operator's own deployment,
  not on further research. Logged as its own entry (2026-07-29) per the
  audit-verification pass's finding that this specific sub-question was
  previously only reachable as a paragraph inside the `ipsec_profile_2`
  entry above, not as a locatable item on its own.
- **Exactly what is unresolved:** whether prioritizing a fix for the
  `ipsec_profile_2` staleness gap (see `ipsec_profile_2` entry above;
  `DECISIONS.md` D-009) is urgent or cosmetic depends on whether **any**
  account in this operator's own configured IPSec client list
  (`ipsec_client_list_view`, i.e. the merged `ipsec_client_list_1` /
  `ipsec_client_list_2` nvram pair) has `ver` 2 or 3 (IKEv2-capable). If
  every configured account is `ver` 1 (IKEv1-only), the stale
  `ipsec_profile_2` is very likely safe and cosmetic — nothing consumes it.
  If any account is IKEv2-capable, this is a live risk of unconfirmed
  real-world severity after any virtual-subnet or DNS-hostname change.
- **Why it's blocked:** this is a fact about which accounts the operator
  has actually configured on their own router, not something derivable
  from firmware source, this codebase, or further research of any kind.
- **What would close it:** the operator (or an agent with live read access
  to their router) checking their own configured IPSec client accounts'
  IKE-version field. This alone doesn't require write-path testing or the
  VPN hard-exclusion gate — it's a read, not a write — but it does require
  access to the operator's actual current configuration, which no source
  research can substitute for.
- **Where:** `src/pages/defs/ipsec.ts` (`ipsec_client_list_view` derive
  logic); the underlying nvram keys are `ipsec_client_list_1` /
  `ipsec_client_list_2`.

## Audit-verification pass findings (2026-07-29)

Note: the source report cited throughout this section,
`.audits/merlins_cloak_v2_AUDIT_VERIFICATION_2026-07-29.md`, is gitignored
and untracked. It exists only on the machine where the audit-verification
pass was run. The findings below are reproduced in full here specifically
so they persist in tracked history independent of that local-only file.

Report reliability caveat: this audit-verification report's own
methodology section states that only one of its two source third-party
audit reports exists as a file on disk in this repository,
merlins_cloak_v2_SECURITY_AUDIT_2026-07-29.md. The second, described only
as a general-purpose report, has no filename or path given anywhere and
was checked only against a paraphrase from a task brief, not read
directly. Any finding here framed as resolving a disagreement between the
two source reports should be read with that in mind: one side of that
comparison rests on secondhand paraphrase, not a directly verified
document.

### Content Security Policy — confirmed Info, no action needed
No content_security_policy key exists anywhere in wxt.config.ts's manifest
factory. The MV3 platform default, script-src self and object-src self, is
therefore in effect. Given this codebase's actual permission and code
surface, no eval or new Function usage, no inline extension-page scripts,
React's default escaping for UI content, the platform default is adequate.
No action needed.

### .gitignore recommendation — refuted, already stale when written
The source report recommended adding .audits/ to .gitignore. This
repository's .gitignore already contained that entry three days before the
report was written, added in a prior commit. This recommendation was
already stale at the moment it was made. No action needed; noted only as a
provenance observation about this source report's own thoroughness.

### Full-history secret scan — CLOSED 2026-07-31
Closed by two independent dedicated-scanner runs: gitleaks 8.30.1
(located via winget's install; full default ruleset including entropy
rules) scanned all 88 commits — 6 findings, every one a false positive
(the `generic-api-key` rule matching nvram parameter-name string
literals such as `ipv6_dnsenable` in page defs; each verified in place
as a key name, not a value). trufflehog v2.2.1 (pip) regex scan across
the same history: zero findings. No real secret exists in tracked
history. Original entry preserved below for context.

### Full-history secret scan — partial, open, actionable (original entry)
This session's own new commits have been independently, fully diff-read
for secrets by two separate pre-push commit reviews and confirmed clean;
this item does not concern those. Separately, and distinctly: the broader
question of whether this repository's full pre-existing git history has
ever been properly secret-scanned remains only partially answered. No
dedicated secret-scanning tool, such as gitleaks or trufflehog, was
available in the environment where this was checked. A fallback bounded
manual search across nine high-signal patterns found zero credential
matches; all non-zero hits were confirmed false positives, prose inside
audit-report or tooling documents discussing which patterns to search for.
This is not equivalent to a full-history entropy scan. Installing a
dedicated scanner and running a proper full-history scan remains open and
actionable.

### `brace-expansion` / minimatch High-severity chain (9 findings)
- **Status: CLOSED 2026-07-31** (`3f4e5c5`, `ec717ca`). eslint 9→10
  (+@eslint/js 10, typescript-eslint 8.65, eslint-plugin-react-hooks
  7.1.1), wxt 0.20→0.21 (+@wxt-dev/module-react 1.2.2) cleared six of
  the nine; the last three lived in eslint-plugin-react's own nested
  minimatch with no safe override (patched minimatch/brace-expansion
  changed their CJS entry points and would break the plugin — verified
  empirically), so eslint-plugin-react was removed instead: it
  contributed zero active rules (only `react/react-in-jsx-scope: 'off'`,
  disabling a rule that was never on; no preset extended). `npm audit`:
  **0 vulnerabilities**. One knock-on: wxt 0.21's generated tsconfig
  newly defaults `noUncheckedIndexedAccess: true`; explicitly set false
  in the root tsconfig (50+ pre-existing strict-null sites, config-level
  resolution chosen over code churn). `RAW/` also added to eslint
  ignores (flat config doesn't honor .gitignore; bare `npx eslint .`
  previously failed on vendored firmware JS in the primary checkout).
- **Status (original):** Confirmed open, High severity, not yet fixed. Not subject to
  the VPN/firewall write-path hard-exclusion policy — fully implementable
  and testable (build + lint + typecheck) without any router or live-
  hardware involvement, unlike the write-path items above.
- **Finding:** `npm audit` reports 9 High-severity findings, all tracing to
  a single root cause — `brace-expansion` (GHSA-mh99-v99m-4gvg) — cascading
  through `minimatch` into `eslint`, `eslint-plugin-react`, and `wxt` (via
  `web-ext-run`/`multimatch`). Confirmed via a fresh `npm audit --json` run
  during the 2026-07-29 audit-verification pass, cross-checked against two
  independent third-party audit reports that made the same root-cause
  claim. Zero overlap with the 2026-07-27 fleet-wide remediation
  (`7853eea`: shell-quote, adm-zip; `99b7a92`: uuid, tmp, esbuild) — this
  is a distinct, previously-known-and-deliberately-deferred gap, not a
  regression (`99b7a92`'s own commit message already identified this exact
  instance and explicitly deferred it). All 9 are dev-only; nothing
  vulnerable ships in the built extension artifact.
- **Fix:** requires coordinated major-version bumps — `eslint` (9→10),
  `eslint-plugin-react` (npm's own suggested target, 7.22.0, is a
  *downgrade* from the current `^7.37.5` constraint and should not be
  trusted mechanically — needs a manually-verified compatible version),
  and `wxt` (0.20→0.21) — each re-verified against `tsc --noEmit`,
  `eslint`, and both `build`/`build:firefox` afterward.
- **Where:** `package.json` devDependencies (`eslint`, `eslint-plugin-
  react`, `wxt`); full analysis and fix plan in
  `.audits/merlins_cloak_v2_AUDIT_VERIFICATION_2026-07-29.md` §6. Decision
  record: `DECISIONS.md` D-013.

### Host permissions — store-listing justification text, not a code fix
- **Status:** Confirmed finding, but **already substantially addressed** —
  logged here as a cross-reference so it does not get picked up later as a
  dangling code-fix task.
- **What:** `wxt.config.ts:50`'s `optional_host_permissions:
  ['http://*/*', 'https://*/*']` is functionally an all-URLs declaration.
  One of the two third-party audit reports verified during the 2026-07-29
  audit-verification pass flagged this as High
  (`.audits/merlins_cloak_v2_AUDIT_VERIFICATION_2026-07-29.md` §7).
- **Why this is not a code task:** confirmed independently that the
  *actual* runtime restriction is already correct — `App.tsx`'s
  `isPrivateRouterHost()` limits every actual permission request to RFC1918
  / loopback / `.local` hosts before `browser.permissions.request()` is
  ever called — and separately confirmed that narrowing the *declared*
  `optional_host_permissions` pattern itself is **not feasible**: WebExtension
  match-pattern syntax cannot wildcard individual IP-literal octets, so
  "RFC1918 only" cannot be expressed as a manifest pattern at all. This
  matches what `GOALS.md`'s "Chrome Web Store submission readiness" goal
  already recorded on 2026-07-28: permissions justification text
  grounded in the actual runtime code, explicitly citing this as "a
  Chrome match-pattern platform limit, not unminimized scope." The
  verification pass independently re-confirmed that framing is technically
  accurate rather than merely asserted.
- **What actually remains:** confirm this justification is present and
  clear in the drafted `docs/CHROME_STORE_LISTING.md` before Chrome Web
  Store submission (`GOALS.md` tracks the submission goal itself). No
  Firefox AMO signing/listing goal is currently tracked in `GOALS.md` (only
  "Firefox live verification," which is about loading the build against
  hardware, not store submission) — when one is created, this same
  justification-not-code framing should carry over to it rather than being
  re-derived.
- **Where:** `wxt.config.ts:50`; `src/entrypoints/popup/App.tsx`
  (`isPrivateRouterHost`); `docs/CHROME_STORE_LISTING.md`; tracked goal in
  `GOALS.md` ("Chrome Web Store submission readiness").

## 1.0-readiness pass, new items (2026-07-31)

### Dashboard network-centric SSID view — live confirmation pending
- **Status:** Code shipped and harness-verified (`0df9636`); three
  specific facts could not be verified without live hardware and belong
  in the operator's next live pass:
  1. Whether multiple MAINFH-tagged `sdn_rl` records actually occur with
     Smart Connect off on this firmware (the code enumerates all matches
     defensively; never exercised against real multi-MAINFH data).
  2. Real-world `apg{idx}_dut_list` band-bitwise values (decode logic
     sourced from native SDN.asp JS + `amas_apg_shared.h`, not a live
     capture).
  3. Whether MAINBH records carry a nonzero `apg_idx` in practice (both
     cases handled; only the synthetic fixture exercises the name-based
     filter path).
- **Where:** `src/pages/defs/dashboard.tsx`, `src/lib/sdn.ts` (shared
  parser, also consumed by `sdn.tsx`).

### Wireless-general SSID semantics on SDN units — deferred, write-path
- **Status:** Open, deliberately deferred (the SSID investigation's
  "Option C"). `wireless.ts` reads/writes `wl{p}_ssid`, which on
  SDN-managed ASUSWRT 5.0 holds a placeholder, not the broadcast SSID;
  the page has no per-SDN-network concept. Which nvram family SSID
  *writes* should target on SDN units (`wl{p}_`, `apg{idx}_`, or
  band-role-token keys per asus.js `wlBandSeq`) is genuinely unresolved
  from source. Currently inert: `writeExclusion: 'wireless'` blocks
  submission and read confidence is `structural`. Do not touch without a
  dedicated supervised session — this is a write surface with a real
  risk of targeting the wrong key family.
- **Where:** `src/pages/defs/wireless.ts` (header comment already flags
  the ambiguity); investigation record in this file's history and
  D-021.

### gh-pages privacy policy duplicate — manual sync pending
- **Status:** Open, small, operator-adjacent. `docs/privacy-policy.md`
  on `main` was updated 2026-07-31 (third stored value: the popup master
  switch's `enabled` flag, `a553f5f`); the manually-maintained duplicate
  `privacy-policy.html` on the `gh-pages` branch has NOT been synced.
  Per D-018, avoid concurrent-session branch operations — sync it in a
  dedicated step (checkout `gh-pages`, mirror the stored-data list,
  push is operator-authorized).

### `wps_band_x` — untested field on an otherwise live-verified page
- **Status:** Open. `wpsPage`'s `wps_enable` field is now live-verified
  bidirectionally (D-022); `wps_band_x` (the WPS target-band picker,
  relabeled and gated in D-023) has never been submitted. Low risk —
  the field only selects which radio accepts the next WPS pairing
  request, doesn't touch SSID/security/channel — but unverified is
  unverified. A natural next low-risk supervised test if more wireless
  write-path coverage is wanted.
- **Where:** `src/pages/defs/wireless.ts` `wpsPage`.

### `band5g_2_support` hardware — WPS "5 GHz-2" option untested
- **Status:** Open, structural only. D-023 added a third WPS band
  option ("5 GHz-2") gated on `band5g_2_support`, sourced from native
  firmware JS (`get_band_str()`) for tri-band hardware with two 5 GHz
  radios and no 6 GHz radio (e.g. RT-AC3200-class) — mutually exclusive
  with the operator's own `band6g_support` RT-BE92U, so this gate has
  never fired against live capability data, only against a synthetic
  harness fixture confirming the negative case (option correctly
  absent when the flag is unset). Also: native relabels the "5 GHz"
  option to "5 GHz-1" on this hardware class; this project's
  `FieldOption` has no conditional-label mechanism, so that option
  keeps displaying "5 GHz" there — a documented, deliberately-accepted
  cosmetic imprecision (D-023), not a value/write-path bug.
- **Where:** `src/pages/defs/wireless.ts` `wpsPage`'s `wps_band_x`
  options; gate mechanism in `src/pages/types.ts` (`FieldOption.gate`)
  and `src/ui/SettingsPage.tsx` (`FieldControl`).

## Missing features (deferred scope)

**Status: CLOSED 2026-07-31 — the single-pass implementation ran the same
day** (D-026; commits `c125776`..`e2a4e1e`). Per-feature outcomes:
1 SDN profile CRUD → shipped, 'wireless' hard-blocked (`c788744`).
2 Samba/FTP per-user permissions → read-only viewer shipped (`97f1d5f`);
  write side is a follow-up loop (guarded dedicated-CGI extension, below).
3 OpenVPN client list → shipped (`0000512`). 4 WireGuard peers → shipped
(`0000512`). 5 Cert/key BLOBs → read + paste-replace shipped (`6060d5f`);
uploads are a follow-up loop (below). 6 Operation Mode → read + full
write-path record shipped, no write block by design (`697367d`, D-026).
7 Time Machine → shipped (`7551915`). 8 Download Master → read-only status
(`7551915`; write is closed-source-gated, documented in the def).
9 AiMesh → shipped, three per-node actions (`f76cb6c`). 10 Notification
center → shipped incl. mark-read (`eede3f3`). 11 QOSUserPrio → shipped
(`0ad7090`). 12 Dual-WAN dashboard → shipped (`c125776`). 13 Second WG
server instance → shipped (`0000512`). Every new write path is
`unverified-write` and none has ever been live-submitted — live
verification folds into the standing operator-gated goal in GOALS.md.
The original list below is retained for its per-feature descriptions.

Each of these is a genuinely new feature — nothing currently reads or
writes for them, this isn't a bug fix. Pure implementation work; no live
router needed until final verification. Listed roughly in the order
STATUS.md originally deferred them, not a priority ranking — an agent
picking this up should feel free to resequence.

1. **SDN profile creation/editing** — currently read-only overview only
   (`src/pages/defs/sdn.tsx`); profile CRUD deferred.
2. **Per-user Samba/FTP permissions** — the USB sharing views
   (`src/pages/defs/usb.ts`) cover shares but not per-user permission
   grants.
3. **OpenVPN server client list** (`vpn_serverx_clientlist` — username/
   password client management).
4. **WireGuard server peers** — peer add/edit/remove for the WireGuard
   server role (distinct from the `wgs1_*` write-correctness question
   above, which is about the server's own config, not peer management).
5. **Certificate/key BLOB handling** — upload/view/replace for TLS certs
   and keys across VPN and admin contexts.
6. **Operation Mode switching** (router/AP/repeater/media bridge modes).
7. **Time Machine** (USB-attached Time Machine backup target config).
8. **Download Master** (USB download-station app).
9. **AiMesh node management**.
10. **Notification center**.
11. **`Advanced_QOSUserPrio`** — per-priority percentage allocation,
    distinct from the QoS rules/limiter/classification views already
    implemented.
12. **Dashboard WAN card dual-WAN aggregation** — currently shows `wan0`
    only; no aggregated view when dual-WAN is active.
13. **Second WireGuard server instance** — the backend supports up to two
    WireGuard server instances, gated behind a constant `WG_SERVER_MAX` equal
    to two, with unit-parameterized nvram key and interface handling throughout
    native source. This project's WireGuard server support, both the original
    implementation and the recent write path fix, is scoped to instance one
    only, matching the single instance the native UI itself exposes. Adding a
    second instance would require new UI surface for instance selection or a
    second instance's settings, plus posting with `wgs_unit` set to two instead
    of the currently hardcoded one. Not currently planned; source confirms it
    is architecturally possible, not that it is required.

## Deferred-features pass, new items (2026-07-31)

### Guarded dedicated-CGI write extension — operator-reviewed pass wanted
- **Status:** Open, deliberately reserved. Three shipped-read-only surfaces
  share one blocker: their native writes are dedicated CGI endpoints
  outside the write chokepoint's endpoint vocabulary
  (`'applyapp' | 'start_apply'`): the six `/aidisk/*.asp` account/permission
  endpoints (usb-accounts), the cert/key upload endpoints
  (`upload_cert_key.cgi`, `upload_wgc_config.cgi` — multipart), and
  Download Master's `apps_action`. Extending the chokepoint is safe in
  principle (same interlock, same exclusion check, and redaction now
  exists for the password/key params these would carry — `b155fa0`), but
  it is a change to load-bearing safety architecture and is reserved for a
  pass the operator reviews. Full endpoint/param citations live in the
  research briefs' findings as recorded in each def's header comment.
- **HARD DESIGN CONSTRAINT (from rc-source research, 2026-07-31, D-028 /
  `docs/RC_SOURCE_FINDINGS.md` §3):** any such extension MUST sanitize `;`
  — and validate against the rc-service tokenizer — in every value that can
  reach an `rc_service`/`action_script` field. The firmware's
  `handle_notifications()` splits `rc_service` on `;` *before* argv, and
  Download Master's `apps_action` passes attacker-controllable fields into
  that mini-language gated only by a closed-source, unverifiable
  `check_cmd_whitelist()`. A smuggled `;` is a real injection primitive
  (e.g. appending `reboot`). Do not trust the firmware's own gate. This
  specifically raises the bar on any Download Master write path;
  independent of it, DM's own management UI lives on port 8081 outside
  httpd's reach, so DM stays **read-only** with a source-backed reason.
- **Accounts specifically (RC_SOURCE_FINDINGS.md §5):** the
  `add_account`/`del_account`/`mod_account`/`set_permission` helpers are
  confirmed absent from the whole `RAW` tree (closed-source); `start_samba()`
  bulk-reprovisions from `acc_list` on every restart. So the write path must
  go through the firmware's own CGI handlers — replicating `acc_list`
  directly would skip invisible validation. Don't do that.
- **Where:** `src/lib/router-io.ts` (WriteEndpoint), `src/lib/write-guard.ts`;
  consumers `usb-accounts.tsx`, `certificates.tsx`, `usb.ts` (DM).

### On-screen credential display — operator UX decision
- **Status:** Open, small. Broadened 2026-07-31 from the original
  WireGuard-only framing after harness verification observed the same
  pattern on a second surface. Two cases, both native-parity, both
  deliberate-not-accidental:
  1. WireGuard server/peers render private-key and PSK values as readonly
     fields (`vpn-server.ts`: `wgs{p}_priv`, `wgs1_c{p}_priv/psk`).
  2. The OpenVPN `vpn_serverx_clientlist` and the pre-existing
     `pptpd_clientlist` render their password column in **plain text, in an
     unmasked text input** (`type="text"`, not `type="password"`) — observed
     directly in the fixture harness, `116455b`. The PPTP case predates this
     work; the OpenVPN one arrived with the client-list feature (`0000512`)
     and simply inherited the rule-list editor's generic column rendering.
- **The question for the operator:** whether to keep native parity
  (values visible and copyable, which is what the router's own UI does) or
  add a masked-with-reveal treatment. A `ListColumn` variant that renders a
  password-type input, plus the same treatment for the readonly key fields,
  would be a contained change — but it is a deliberate divergence from
  native, so it is not being made unilaterally.
- **Not a logging/leak issue:** none of these values reach the console, the
  diagnostics write inspector, or retained verify detail — redaction at
  request construction covers that (D-027, `b155fa0`), and readonly fields
  are never posted at all. This is strictly about what a person standing
  behind the operator can read off the screen.
- **Where:** `src/pages/defs/vpn-server.ts` (WG key fields; OpenVPN and PPTP
  client lists), `src/ui/ListEditor.tsx` + `ListColumn` in
  `src/pages/types.ts` (where a masked column type would live).

### Operation Mode write construction — needs a supervised session
- **Status:** Open by design (D-026). The full mode→nvram matrix, the QIS
  wizard's chip-conditional superset problem, and the post-switch
  reachability risks are recorded in `opmode.ts`'s header for whoever
  builds the write under supervision. Do not build it unattended.

### SDN captive-portal keys — unclassified write mechanism
- **Status:** Open, informational. `cp{idx}_*` keys could not be classified
  against the table-driven write path (possible silent drop); SDN editor
  excludes them entirely. Recorded in `sdn.ts`/`sdn.tsx` headers.

## Non-security audit pass, new items (2026-07-31)

A third-party non-security audit (Google Gemini 3.1 Pro) was run against
this repo and independently verified before filing here — see
`.audits/NON_SECURITY_AUDIT_2026-07-31.md` (original) and
`.audits/NON_SECURITY_AUDIT_VERIFICATION_2026-07-31.md` (verification,
with corrected file:line citations and offender lists; both gitignored).
Only its §3.1-equivalent (code quality & consistency) findings were
delivered — the audit's own scope note committed to architecture,
docs-drift, and verification-gap sections that never shipped. That gap is
not re-opened here as a loop of its own; the verification report's §3 has
a ready-made worklist if a future pass wants to finish it.

### Custom-page loading/error shell inconsistency
- **Status:** Open, low-cost, solo-completable.
- **What:** two divergent patterns for custom-page (`SettingsPageDef`
  render functions with `kind: 'custom'`) loading/error state. Most pages
  render `<h1 className="mc-page-title">` and the layout shell
  unconditionally, with `<Loading />`/`<Banner tone="err">` nested inside
  it. Five pages instead early-return the loading/error state *before* the
  title renders, so the title vanishes during reload or on error — a
  perceived-stability regression relative to the rest of the app.
- **Where (all five, corrected from the audit's original list of two):**
  `src/pages/defs/aimesh.tsx:362` (before title at `:370`),
  `src/pages/defs/wol.tsx:90` (before `:97`),
  `src/pages/defs/nettools.tsx:105` (before `:113`),
  `src/pages/defs/traffic.tsx:185-186` (before `:192`),
  `src/pages/defs/dashboard.tsx:257-258` (before `:278` — this is the
  landing page, so it's the highest-traffic offender).
- **Fix shape:** move the title (and any static layout chrome) above the
  early-return guards in each file, matching the pattern already used by
  `clients.tsx`, `vpn-status.tsx`, `certificates.tsx`, `notification.tsx`,
  `extension.tsx`, `sdn.tsx`, `logs.tsx`, `usb-accounts.tsx`,
  `site-survey.tsx`, and `qos-stats.tsx`. Mechanical, no data-flow change.

### `ListColumnDef` lacks column-level read/write mappers
- **Status:** Open, informational/backlog — not urgent.
- **What:** `src/lib/rulelist.ts`'s `parseRuleList`/`serializeRuleList`
  handle the standard `<`/`>` two-level nvram list encoding, but several
  page defs bypass it with bespoke `split`/`join` because the firmware's
  actual on-wire format diverges per-field (padded columns, KB/s stored vs
  MB/s displayed, or — `parental.ts`'s case — four parallel `>`-joined
  keys instead of one `<`/`>` list at all). Confirmed bypass sites:
  `dnsdirector.ts`, `vpn-server.ts`, `ipsec.ts`, `vpn-client.ts`,
  `firewall.ts`, `usb.ts`, `qos.ts`, `lib/sdn.ts`.
- **Possible direction:** extend `ListColumnDef` (`src/pages/types.ts`)
  with optional `mapRead`/`mapWrite` per-column hooks so the common
  padding/unit-conversion cases can use the shared utility instead of
  reimplementing list virtualization per page. `parental.ts`'s
  parallel-keys case would still need bespoke handling regardless — it
  isn't a `<`/`>` list at all.
- **Where:** `src/lib/rulelist.ts`, `src/pages/types.ts` (`ListColumnDef`).

### `buildFields`/`buildVerify` duplication — accepted risk, not a defect
- **Status:** Closed as understood/accepted; recorded here only so a
  future session doesn't rediscover it as a "new" finding.
- **What:** `SettingsPage.tsx:238` defaults the write-verification payload
  to raw `dirty` UI state unless a page def supplies `buildVerify`. Pages
  with virtual fields (UI-only keys that don't exist in nvram, e.g.
  `qos_orates_min_0` in `qos.ts:558-580`) must supply both `buildFields`
  and `buildVerify`, and the two are near-identical by necessity — one
  maps virtual→real for the write, the other for the read-back check.
- **Why this is a real (if low-probability) verification-gap:** neither
  `tsc --noEmit`, `eslint`, nor the screenshot harness would catch the two
  functions silently diverging if a future edit updates one virtual-field
  mapping and not its pair — both compile clean, lint clean, and render
  identically in every fixture. This is exactly the class of regression
  `.raiden/local/prompts/non-security-audit-handoff.md` §3.4 asked this
  audit to find, and it's the strongest concrete example in the repo.
- **Not filed as an actionable fix:** the duplication is a direct
  consequence of the `dirty`-default design, not a mistake, and
  de-duplicating it would mean re-deriving `buildVerify` from
  `buildFields` generically — a real refactor, not a bug fix. If it's ever
  worth doing, treat it as its own scoped design task, not a quick fix.
- **Where:** `src/ui/SettingsPage.tsx:238`; representative pairs in
  `src/pages/defs/tools-tweaks.ts:135-156`, `qos.ts:213-230,558-580`.

## Cross-reference: pre-existing, operator-gated loops

Tracked in full in `GOALS.md`, not duplicated here — both require the
operator's live router and/or browser, not solo-agent-completable:

- Live-hardware verification of write paths (47 of 49 pages never
  live-submitted at all; one page — `wpsPage` — is now a partial
  exception: `wps_enable` live-verified bidirectionally 2026-07-31,
  `wps_band_x` still untested. See `GOALS.md` and
  `docs/WRITE_PATH_CHARACTERIZATION.md` §4.).
- Firefox live verification (never run against live hardware at all).
