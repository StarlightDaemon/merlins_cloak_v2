# Open Loops

Each entry below is written to be picked up standalone, by an agent session
with no memory of how it got here. Grouped by track; within a track, ordered
roughly by how self-contained the work is, not by priority.

## Chrome Web Store readiness

### Store listing screenshots
- **What:** Capture real screenshots of the extension UI for the Chrome Web
  Store listing. At least one (1280×800 or 640×400) is required;
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
- **Status:** Confirmed open, **High** severity, conditional risk (severity
  confirmed by external audit cross-check, 2026-07-29 — see below; the
  conditional framing itself is unchanged and still open).
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
- **Status:** Confirmed open, split verdict by service, partially unresolved.
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

### rc daemon stop-vs-restart behavior — blocked, source unavailable
- **Status:** Open, blocked. Logged as its own entry (2026-07-29) per the
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
- **Status:** Open, blocked on a fact about the operator's own deployment,
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

## Missing features (deferred scope)

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

## Cross-reference: pre-existing, operator-gated loops

Tracked in full in `GOALS.md`, not duplicated here — both require the
operator's live router and/or browser, not solo-agent-completable:

- Live-hardware verification of write paths (48 of 49 never live-submitted).
- Firefox live verification (never run against live hardware at all).
