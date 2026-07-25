# External Research Reconciliation

Reconciliation of two independent external research reports, each given an
identical adversarial due-diligence brief covering this project's
architecture, empirical findings, and open risks. Neither external report
was produced by this project; both are raw input material, relocated to
`RAW/external-research/` (gitignored) and read in full for this pass.

Reconciled against the four committed reports in `docs/`:
[`STOCK_VS_MERLIN_DIFF.md`](STOCK_VS_MERLIN_DIFF.md),
[`CROSS_GENERATION_DIFF.md`](CROSS_GENERATION_DIFF.md),
[`LIVE_PROBE_RT-BE92U.md`](LIVE_PROBE_RT-BE92U.md), and
[`WRITE_PATH_CHARACTERIZATION.md`](WRITE_PATH_CHARACTERIZATION.md), read
from the committed files rather than from prior conversation.

Throughout, the two external reports are referred to as **Report A** and
**Report B**, matching their relocated filenames. Model attribution for
each is **not stated** in either document — see §6.

---

## 1. Would change the plan — consolidated and prioritized

Six items survived scrutiny. They are ordered by how much they constrain
work that has not yet been done, not by how loudly either report asserted
them.

### 1.1 Prototype `applyapp.cgi` delta writes before committing the write layer — HIGH

**Both reports independently surfaced this and it is the single most
consequential item.** Asuswrt exposes an app-style endpoint pair used by
the official Asus mobile app and by mature third-party clients:
`appGet.cgi` (reads, `hook=`-parameterized, JSON responses) and
`applyapp.cgi` (writes, accepts `action_mode=apply` plus a small
key/value delta rather than a whole page's field set).

This is **not** a contradiction of
[`WRITE_PATH_CHARACTERIZATION.md`](WRITE_PATH_CHARACTERIZATION.md) — see
§2.2. That report's whole-page-resubmission finding is explicitly scoped
to the `.asp` → `start_apply.htm` browser form path it actually tested,
and is correct for that path. What both external reports establish is
that a *second, unexercised* path exists which would avoid the
clobber-the-other-fields hazard entirely.

Partial corroboration already exists in this project's own data:
[`LIVE_PROBE_RT-BE92U.md`](LIVE_PROBE_RT-BE92U.md) §5 recorded
`appGet.cgi?hook=nvram_char_to_ascii(...)` calls firing live on the
operator's RT-BE92U while loading `SDN.asp`. **The read half of this API
is confirmed present on the actual target unit.** The write half
(`applyapp.cgi`) appears nowhere in this project's live data and remains
entirely unverified here.

**Action:** prototype a single non-destructive `applyapp.cgi` delta write
against the RT-BE92U in a dedicated, operator-supervised session, using
the same staged-approval discipline as the existing write-path session.
Do **not** adopt it on external say-so. Neither report tested it against
an RT-BE92U running Merlin 3006 — both infer it from third-party client
libraries and forum posts. Coverage across all settings categories is
unmapped by both.

*What would change the approach:* if `applyapp.cgi` does not cover a
needed category, fall back to full-form resubmission for that category
only, rather than abandoning either path wholesale.

### 1.2 Never proxy router requests through the background service worker — HIGH

**Both reports converge on this, from different reasoning, and it is a
hard architectural constraint on how the WXT extension is structured.**
All fetches to the router must originate in the content script running
in the router page's own origin. A fetch issued from the background
context carries a `chrome-extension://` origin, which is classified as
public address space; a public→local request is exactly what Local
Network Access gates, and because the router is plain HTTP the browser
cannot show a permission prompt to rescue it. Report B is right that
this failure mode is silent and fatal.

This is cheap to honor now and expensive to retrofit. Treat "the content
script owns all router I/O; the background worker never touches the
router" as a settled constraint. See §3 for the full LNA detail,
including which parts of Report B's LNA reasoning did *not* survive.

### 1.3 Adopt Shadow DOM encapsulation for the mounted React root — HIGH

**Unanimous across both reports, and this project has committed nothing
on it either way** — the four committed reports are firmware analysis and
contain no frontend decisions. Mounting a React tree into the light DOM
of a 2015-era server-rendered page exposes it to the host's broad
un-namespaced element selectors (`table`, `div`, `input`), in both
directions.

Two concrete constraints come with it: external stylesheets and
`@import` do not work inside a shadow root, so CSS must be injected as
adopted stylesheets or an inline `<style>` at the shadow root; and React
must attach its event listeners to the shadow container rather than
`document`, which requires React 17+. **The React-version constraint is
already satisfied** — [package.json](package.json) pins React `^19.2.4`.

### 1.4 Implement an EULA gate before any AiProtection / DPI / advanced-QoS toggle — MEDIUM

**Report B only, but corroborated by this project's own committed data,
which is why it survives.** Report B's claim is that Trend Micro-backed
features (AiProtection, DPI, adaptive QoS) are gated behind an EULA
acceptance stored in nvram, and that writing the operational flag without
first satisfying the EULA causes the backend to silently reject the
write — producing a UI that displays a feature as active while the kernel
has refused to load it.

This project's own data independently supports the gate's existence:
- [`LIVE_PROBE_RT-BE92U.md`](LIVE_PROBE_RT-BE92U.md) §2.3 — the live
  `rc_support` string on the operator's unit contains the token `eula`.
- [`CROSS_GENERATION_DIFF.md`](CROSS_GENERATION_DIFF.md) §6.3 —
  `set_ASUS_NEW_EULA.cgi*`, `get_ASUS_privacy_policy.cgi*` and
  `set_ASUS_privacy_policy.cgi*` are all present in RT-BE92U **stock**
  `mime_handlers[]`, i.e. Asus platform endpoints, not Merlin additions.
- [`CROSS_GENERATION_DIFF.md`](CROSS_GENERATION_DIFF.md) §6.2 — the
  static `tm_eula.htm` / `asus_eula.htm` pages exist on the 4.0
  generation and in neither RT-BE92U tree.

**Correction to Report B's specifics:** it names `set_TM_EULA.cgi` and
`set_ASUS_EULA.cgi`, citing a legacy `asuswrt-rt` source repository. This
project's own data shows the 3006-era endpoint on the actual target
hardware is `set_ASUS_NEW_EULA.cgi`, alongside the privacy-policy pair.
Report B's *finding* is sound; its *endpoint names are stale for this
generation*. Resolve the real names live before implementing.

### 1.5 Smoke-test Local Network Access on both browsers early — MEDIUM

Both reports flag it; **neither empirically tested it**, on either
browser. Both reason that a same-origin local→local content-script fetch
crosses no address-space boundary and is therefore exempt, and that
reasoning is sound — but it is reasoning, not a result. Firefox's
treatment of this exact case is undocumented by both.

A trivial same-origin `fetch()` from the content script, run on Chrome
≥142 and Firefox with the LNA pref active, closes this in minutes and
should be done before more architecture is built on the assumption. See
§3.

### 1.6 Treat the ROG/GT UI variant as a real DOM-takeover coverage gap — MEDIUM

**Report A only, and it is a genuine addition neither this project's
reports nor Report B addressed as a risk.** ROG/GT models historically
ship a distinct ROG-themed web UI, gated in firmware source by
`RTCONFIG_ROG`, delivered as a separate `_rog` firmware image, and
routing apply through a different endpoint constant. A DOM-takeover shim
keyed to standard RT markup will not match ROG page structure.

This project's data confirms the ROG surface exists in the trees analyzed
but says nothing about whether it is *served*:
[`STOCK_VS_MERLIN_DIFF.md`](STOCK_VS_MERLIN_DIFF.md) §3.2 lists
`sysdep/FUNCTION/ROG_UI/Main_TrafficMonitor_{daily,monthly}.asp` as
Merlin-only files, §3.4 records `require/menuTrees/menuTree_ROG.js`
differing by 71 lines, and
[`CROSS_GENERATION_DIFF.md`](CROSS_GENERATION_DIFF.md) §4 lists `ROG_UI`
among the six `sysdep/FUNCTION/` groups universal to all four trees.
Report A separately quotes Merlin as not supporting the ROG webui variant
in the 3006 series. Those are consistent under this project's own
established "source presence ≠ served page" principle
([`STOCK_VS_MERLIN_DIFF.md`](STOCK_VS_MERLIN_DIFF.md) §6.1, confirmed
live in [`LIVE_PROBE_RT-BE92U.md`](LIVE_PROBE_RT-BE92U.md) §4).

**Practical consequence:** this is a further argument for the same
structural decision as §1.1 — build the data layer against endpoints
(`appGet.cgi` / `applyapp.cgi` / nvram) rather than by scraping rendered
`.asp` DOM, so that per-variant code is confined to the thin
"hide the native page and mount" shim. No ROG hardware is available to
test against, so this stays a design hedge, not a verified requirement.

### 1.7 Explicitly rejected — did not survive scrutiny

Listed so they are not silently re-raised later:

| Claim | Source | Why rejected |
|---|---|---|
| "The no-CSRF-token finding is demonstrably false; the client must actively manage the `asus_token` lifecycle" | B | Conflates a session cookie with a CSRF token; contradicted by B's own cited CVEs and by this project's live result. Full adjudication in §2. |
| "Abandon `/start_apply.htm` immediately; the plan is obsolete" | B | The substance (a delta-write path exists) is accepted in §1.1. The urgency is not: neither report live-tested `applyapp.cgi`, its coverage is unmapped by both, and the tested path demonstrably works. Pivot on evidence, not on assertion. |
| "All fetch calls must be annotated `{ targetAddressSpace: 'local' }`" | B | Self-contradictory and not required for the same-origin case. See §3.3. |
| "Implement firmware-aware state abstraction (4.0 vs 5.0 fork)" | B | Correct, but **already this project's committed position**, not a change. [`CROSS_GENERATION_DIFF.md`](CROSS_GENERATION_DIFF.md) §5.1 and §7 already state SDN handling must be generation-gated on `mtlancfg_support` and that "the generation split, not the stock/Merlin split, is what needs the heavier feature-gating." |
| "The 228 `*_support` flags are intrinsically tied to the 5.0 SDN paradigm" | B | Directly contradicted by this project's data. [`CROSS_GENERATION_DIFF.md`](CROSS_GENERATION_DIFF.md) §4 establishes 213 `*_support` flags are universal across all four trees, both generations; §5.4 identifies only 13 as 5.0-exclusive, of which SDN is backed by exactly one (`mtlancfg_support`). |
| "Catalog exhaustive SoC-specific nvram mappings (Broadcom vs MediaTek)" | B | Real but overstated, and unactionable here. See §5.4. |

---

## 2. Write-mechanism contradiction — one exists, and it does not hold up

**Report B contains a direct, explicitly-flagged contradiction of this
project's write-mechanism findings.** Per the escalation instruction it
gets its own section rather than being folded in as a note. Having
examined it, **the contradiction is not sustained**, and
[`WRITE_PATH_CHARACTERIZATION.md`](WRITE_PATH_CHARACTERIZATION.md) §1.3
should stand as written.

### 2.1 The claim

Report B §C states, verbatim in its own framing, that it treats these
discrepancies as serious findings, "**contradicting** the entirety of the
project's empirical write-mechanism conclusions," and specifically:

> "The assertion that no CSRF token exists anywhere in the observed forms
> is demonstrably false."

Its argument: the Asuswrt httpd daemon generates a token named
`asus_token` at `/login.cgi`, sets it as an HttpOnly cookie, and its C
source contains "token-generated module" and "check token module"
validation arrays for sensitive endpoints (WAN, VPN, wireless). It
concludes the extension "cannot rely on the browser automatically
attaching the cookie for all write operations" and must "actively read
the `asus_token` and ensure it is included in the payload or headers."
It attributes this project's failure to detect the token to the probe's
narrow scope — four reversible fields on a Tweaks page.

Its second, milder claim: that nvram polling being the *only* reliable
write confirmation is "a symptom of relying on the legacy HTML
interface," and `applyapp.cgi` returns predictable JSON instead.

### 2.2 Adjudication — the contradiction fails

**The claim conflates a session credential with a CSRF token.** These are
different mechanisms with different threat models, and the distinction is
the whole point of the finding:

1. **An HttpOnly cookie the browser attaches automatically cannot
   function as a CSRF defense.** That is definitional. A CSRF token works
   precisely because it is delivered out-of-band from the cookie — in a
   form field or a custom header — so that a cross-site request, which
   *does* carry the cookie automatically, cannot supply it. Report B
   itself states `asus_token` is set as an HttpOnly cookie at login. By
   its own description, it is a session credential.

2. **Report B's own cited evidence undercuts it.** The AyySSHush
   null-byte finding it cites proves `asus_token` is parsed and evaluated
   as an *authentication* credential — which nobody disputes; this
   project's finding is that auth is cookie-borne. Both CVEs it cites for
   `start_apply.htm` are described as **authenticated** issues, meaning
   they required a valid session, which says nothing about anti-CSRF.

3. **Report A independently confirms the opposite, with direct
   citations.** It quotes CVE-2018-17023 as a CSRF vulnerability against
   `start_apply.htm` on Asus firmware, and CVE-2025-15101 as stating the
   web management interface fails to implement proper anti-CSRF tokens or
   same-origin validation, plus a third-party study finding all HTML
   forms on an Asus router susceptible to CSRF. A published CSRF
   vulnerability *against the exact endpoint in question* is
   incompatible with that endpoint validating an anti-CSRF token.

4. **This project's own result is direct empirical disconfirmation for
   the path tested.** Per
   [`WRITE_PATH_CHARACTERIZATION.md`](WRITE_PATH_CHARACTERIZATION.md)
   §1.3 and §2, 32 named form fields were enumerated and none resembled a
   token; only two non-HttpOnly cookies were visible to page JS, neither
   an auth token; and all four writes **landed and were confirmed by live
   nvram re-read**, submitted through an ordinary browser form POST whose
   only credential was the automatically-attached cookie. If a separate
   token had been required for that endpoint, the writes would have
   failed.

**What Report B is right about, narrowly:** the probe's scope genuinely
was four reversible fields on one Merlin-only page, and
[`WRITE_PATH_CHARACTERIZATION.md`](WRITE_PATH_CHARACTERIZATION.md) §4
already says so at length, hard-excluding wireless, WAN, DHCP, VPN,
firewall and firmware actions and instructing that write mechanics must
be re-derived per category rather than generalized. Report B's scope
observation is therefore **already the project's stated position**. It
supports "unverified for sensitive endpoints," which is what the
committed report says. It does not support "demonstrably false."

### 2.3 The one real residual, which is narrower and different

Report B's closing sentence in that section is worth keeping after the
CSRF claim is discarded: some Asuswrt endpoints validate the `Referer`
(and in some paths `Host`/`User-Agent`) header rather than a token. That
is a plausible and genuinely untested mechanism — this project has never
observed request headers at all
([`WRITE_PATH_CHARACTERIZATION.md`](WRITE_PATH_CHARACTERIZATION.md) §1.4
records that the `POST /start_apply.htm` request and response were never
captured, a tooling limitation).

**This is architecturally reassuring rather than alarming.** A content
script issuing a same-origin fetch from the router's own page sends a
correct same-origin `Referer` and `Host` by construction. A referer check
is a problem for an external client; it is close to a non-issue for the
architecture being built. It does become relevant if any request is ever
issued from a non-page context — a further argument for §1.2.

### 2.4 Verdict and carry-forward

- [`WRITE_PATH_CHARACTERIZATION.md`](WRITE_PATH_CHARACTERIZATION.md)
  §1.3 **stands unchanged.** No CSRF token on the observed form;
  cookie-borne session auth. The Fable session can build on it.
- The whole-page-resubmit finding **stands as scoped** — correct for the
  `start_apply.htm` form path, with `applyapp.cgi` as an unverified
  alternative path to prototype (§1.1). This is a scope extension, not a
  correction.
- **Newly open:** whether any endpoint enforces `Referer`/`Host`/
  `User-Agent` validation. Untested by this project and unresolved by
  either external report. Low architectural risk for a content script;
  worth capturing whenever a session with HTTP-level capture happens, which
  [`WRITE_PATH_CHARACTERIZATION.md`](WRITE_PATH_CHARACTERIZATION.md) §3
  already lists as needed for other reasons.
- **Still open, unchanged:** write mechanics for every category excluded
  in [`WRITE_PATH_CHARACTERIZATION.md`](WRITE_PATH_CHARACTERIZATION.md)
  §4. Neither external report supplies evidence for any of them.

---

## 3. Local Network Access — Chrome and Firefox

Reported separately from general architecture risk, per the brief. The
question had two parts: whether a content script's same-origin fetch
genuinely avoids Chrome's LNA restriction, and what Firefox's equivalent
position is (the Firefox side was unchecked when the brief was written).

### 3.1 Part one — Chrome, same-origin content-script fetch

| | Report A | Report B |
|---|---|---|
| **Answer** | Not gated. Exempt. | Not gated. Exempt. |
| **Reasoning** | LNA gates a request from a public site to a local/loopback address, or from a local site to loopback. A content script in the router page's own origin fetching that same host crosses no address-space boundary. Chrome's own roadmap describes the planned expansion as targeting cross-origin requests to local destinations — so same-origin stays exempt. | Same core reasoning: the content script shares the host page's local address space, so the request is evaluated "Local-to-Local" and does not cross a boundary. States this "theoretically avoids triggering" LNA. |
| **Timeline cited** | Shipped Chrome 142 (28 Oct 2025) on desktop; WebSockets brought under LNA in Chrome 147 (stable ~April 2026). | Enforced as of Chrome 142; permissions split into local-network and loopback-network at Chrome 145. |
| **Tested?** | No. | No. |

**They agree on the answer.** Both derive it, neither measured it. The
reasoning is sound and consistent with how address-space classification
works, so the project's original assumption is corroborated — but the
corroboration is analytic, not empirical, from both sources.

The timeline details differ in a way not worth adjudicating: A cites the
Chrome 142 ship date and a Chrome 147 WebSockets expansion; B cites a
Chrome 145 permission split. These are not mutually exclusive and neither
affects the same-origin conclusion.

**Report B adds one genuinely valuable corollary neither the brief nor
Report A drew out as sharply:** the exemption is a property of the
*content script's origin*, not of the extension. Route the same fetch
through the background service worker and its origin becomes
`chrome-extension://`, classified as public; the request to a local IP
then crosses a boundary and is gated — and because the router is plain
HTTP rather than a secure context, the browser cannot even present the
permission prompt, so the failure is silent. This is the reasoning behind
§1.2 and it is the most useful thing Report B contributes.

### 3.2 Part two — Firefox

**The gap the brief flagged as unchecked is now closed: Firefox has an
equivalent, and it is shipping.** Both reports found it; Report A found
more of it.

| | Report A | Report B |
|---|---|---|
| **Exists?** | Yes. | Yes. |
| **Rollout** | Enabled from **Firefox 149** for users with Enhanced Tracking Protection set to Strict; gradual rollout to all users beginning **Firefox 151**. Enterprise policy support from Firefox 150. | Enabled by default for all users starting **Firefox 151**. |
| **Control** | Pref `network.lna.enabled`. | Pref `network.lna.enabled`. |
| **Same-origin case** | Aimed at public websites reaching local resources, so a same-origin local page *should* be exempt — but explicitly states this specific case is **undocumented for Firefox** and must be smoke-tested. | Asserts Firefox "imposes identical cross-space blocking"; does not separately address the same-origin content-script case beyond the shared Local-to-Local reasoning. |
| **Sourcing** | Mozilla Support article and Firefox 151 release notes, cited directly. | Cites Mozilla Support, MDN, the Firefox admin policy reference — but its footnote for the "151, all users" claim points to an article about **Firefox 153**, a sourcing mismatch. |

**Adjudication: Report A is better-supported on the Firefox timeline and
should be the one carried forward.** It cites the primary sources for the
exact claim, and its 149-with-ETP-Strict detail is the operationally
important one — it means a Firefox user can hit LNA enforcement
*before* 151, which B's "151, all users" framing would let you miss. B's
substance is not wrong, its sourcing is looser and its earliest-onset
date is later than reality.

**Report A is also the more honest of the two on the residual
uncertainty**, explicitly stating the same-origin content-script case is
undocumented for Firefox and must be tested. Report B's confident
"identical" reads past a real unknown.

### 3.3 Where they disagree — `targetAddressSpace: "local"`

**Report B mandates it; Report A does not mention it. Report B's mandate
does not hold.** Report B states all fetches from the React UI must be
annotated `{ targetAddressSpace: "local" }` "to ensure compatibility with
Chrome's mixed-content exemptions."

That option exists to let a page *declare an intended address-space
transition* — the mixed-content relaxation it belongs to is for a secure
public page fetching a local resource. It has no role in a same-origin
fetch from an HTTP page served by the router to that same router: there
is no address-space transition to declare, and no mixed content, because
page and target share both scheme and origin.

Report B's own argument contradicts the mandate: three sentences earlier
it establishes the content-script fetch is Local-to-Local and crosses no
boundary, then requires an annotation whose entire purpose is to declare
a boundary crossing. It is also a Chrome-specific fetch option that
Firefox would ignore, so it cannot be part of a cross-browser
requirement.

Adding it would most likely be harmless, but it is not required, and
adopting it as a blanket rule invites confusion about which requests are
actually crossing address spaces. **Do not adopt it as a standing rule.**
If §1.5's smoke test ever shows a request being gated, revisit it then
with a real symptom to explain.

### 3.4 Against this project's committed findings

Nothing in the committed reports speaks to LNA — it is a browser-platform
question, not a firmware one. The nearest data point is
[`LIVE_PROBE_RT-BE92U.md`](LIVE_PROBE_RT-BE92U.md) §6, which executed a
same-origin `fetch('/update_clients.asp')` from inside the authenticated
page's own JS context and got `200 OK` with a 101,394-byte body. That was
page JS rather than an extension content script, and no LNA-enforcement
state was recorded for that browser, so it is **suggestive, not
dispositive** — it does not substitute for the smoke test in §1.5.

---

## 4. Prior art

### 4.1 What was found

**Report A answered the prior-art question directly and found no
competing tool.** Its finding: no shipped modern browser-extension or
companion-app replacement of the full Asus/Merlin admin UI exists. The
closest efforts are an unreleased hobby project described on SNBForums —
a developer building a Vue.js web app over the router's `httpApi` — and
narrow single-purpose Chrome extensions such as an open-source "ASUS
Download Master" extension. **It explicitly concludes the
build-from-scratch decision is confirmed: there is no substantial project
to fork.**

**What both reports found instead is a mature API-client family, not a UI
replacement:**

| Project | Reported by | What it is |
|---|---|---|
| `asusrouter` (Vaskivskyi) | A, B | Python API wrapper for Asuswrt-powered routers over HTTP/HTTPS. Report A cites a published PyPI release and states it supports both stock Asuswrt and Asuswrt-Merlin, and powers the Home Assistant AsusWRT integration. Both reports identify it as the origin of the `appGet.cgi` / `applyapp.cgi` / `login.cgi`→`asus_token` endpoint model. |
| `ha-asusrouter` (Vaskivskyi) | B | Home Assistant integration built on the above. |
| `ha-asuswrt_merlin` (DigitallyRefined) | A | Merlin-specific Home Assistant integration. |
| `asuswrt-api` (vrachieru) | A | Smaller client; Report A quotes its apply method POSTing a JSON payload to `/applyapp.cgi`. |
| `AsusRouterMonitor` (lmeulen) | A | Monitoring client. |
| SNBForums Vue.js web-UI effort | A | Unreleased hobby project over `httpApi`. Not shipped. |
| "ASUS Download Master" Chrome extension | A | Open-source, narrow single-purpose. |

### 4.2 Maturity assessment

`asusrouter` is the only one that matters, and on the reports' evidence
it is the most mature artifact in this space: a published, versioned
library with an active release history, upstream adoption by a
first-party Home Assistant integration, and — per Report A — coverage
spanning both stock and Merlin firmware and hardware generations from
Wi-Fi 4 through Wi-Fi 7 including the RT-BE92U. Report A adds an honest
caveat that it verified the library's internals from documentation,
changelogs, tracebacks and a sibling client rather than by reading the
library's own connection code line by line, and recommends a reviewer
confirm the literal endpoint enum value in source.

The rest are integrations, thin clients, or unreleased.

### 4.3 Should this change build-from-scratch?

**No for the UI. Yes as a reference for the endpoint layer.**

Nothing found is a UI replacement, so there is no candidate to fork and
nothing that makes this project redundant. The DOM-takeover extension
remains unprecedented on the reports' evidence.

`asusrouter` should be treated as **reference material for the transport
layer**, not as a dependency and not as an authority. It is Python and
therefore cannot be consumed by a browser extension in any case; its
value is that it documents, in working code, which endpoints exist and
what shape they take — which is precisely the §1.1 question. Reading its
endpoint definitions before designing the write layer is worth an hour.
Its licence was not established by either report and would need checking
before any code or non-trivial structure is borrowed rather than merely
consulted.

### 4.4 Where the two reports diverge on prior art

**Report A answered the question that was asked; Report B answered a
different one.** Report B's §A frames `asusrouter`'s existence as proof
that the project's architecture is "fundamentally flawed" and
"obsolete" — but a Python API client and a browser-based UI replacement
are not substitutes for each other, and the existence of the former says
nothing about whether the latter has been built before. Report B never
addresses whether a competing UI-replacement tool exists.

Report A's treatment is the better-supported one on this question: it
distinguishes the two clearly, names the specific narrow extensions and
the unreleased hobby effort that *would* be the real prior art if they
were further along, and draws the correct conclusion for each.

---

## 5. Full reconciliation by question group

### 5.1 Group A — Prior art and alternatives

**Agreement.** Both identify `asusrouter` and the `appGet.cgi` /
`applyapp.cgi` / `login.cgi`→`asus_token` endpoint model as the most
significant existing work, and both treat it as directly relevant to the
project's transport design.

**Disagreement.** Whether prior art undermines the project. Report A: no —
no UI-replacement prior art exists, build-from-scratch confirmed, and
`asusrouter` is a reference for the data layer only. Report B: yes — the
library's existence renders the plan "obsolete."

**Adjudicated: Report A.** Report B conflates "an API client exists" with
"the UI has been built before." These answer different questions, and
only Report A engaged with the one the brief asked. See §4.4.

**Against this project's findings.** Report A's claim that Asus's new
ASUSWRT 5.0 Dashboard does not threaten the target surface soon — because
the redesigned Dashboard is currently ExpertWiFi-only and other models
show old pages inside a wrapper — is consistent with this project's live
data: [`LIVE_PROBE_RT-BE92U.md`](LIVE_PROBE_RT-BE92U.md) §2.1 read
`dashboard_support = 0` on the operator's RT-BE92U, an ASUSWRT 5.0
Wi-Fi 7 unit. Independent corroboration from a completely different
direction. Neither report contradicts anything in Group A.

### 5.2 Group B — Architecture risk and platform trajectory

**Agreement.** Three points, all convergent:
1. The same-origin content-script fetch is not gated by LNA (§3.1).
2. Firefox now has an equivalent restriction, closing the brief's
   unchecked item (§3.2).
3. Shadow DOM encapsulation is required for the mounted React tree, and
   is not merely advisable. Report A adds two implementation constraints
   — CSS must be injected as adopted stylesheets or inline at the shadow
   root because external stylesheets and `@import` do not work there, and
   React must be 17+ so events delegate to the shadow container rather
   than `document`. Report A also recommends lazy-loading across 30+
   views to bound memory.

**Disagreement.**
- `targetAddressSpace: "local"` — B mandates it, A omits it.
  **Adjudicated against B** (§3.3): the option declares an address-space
  transition that a same-origin fetch does not make, B's own Local-to-Local
  reasoning contradicts the mandate, and it is Chrome-only so cannot be a
  cross-browser requirement.
- Firefox onset — A says 149 under ETP Strict then 151 for everyone; B
  says 151. **Adjudicated: A**, better sourced and the earlier onset is
  the operationally relevant one (§3.2).
- Chrome milestone detail — A cites the 142 ship date and a 147 WebSockets
  expansion; B cites a 145 permission split. **Not adjudicated and not
  worth adjudicating** — the claims are compatible and neither changes the
  same-origin conclusion.

**Against this project's findings.** Nothing in Group B contradicts the
committed reports, which contain no browser-platform or frontend
decisions. Group B is almost entirely *additive* to what this project
has established. The Shadow DOM requirement fills a genuine gap; the
React-17+ constraint is already satisfied by React `^19.2.4` in
[package.json](package.json). The nearest committed data point,
[`LIVE_PROBE_RT-BE92U.md`](LIVE_PROBE_RT-BE92U.md) §6's successful
same-origin `fetch()`, is consistent with both reports' LNA conclusion
but was page JS rather than an extension content script and does not
close the question (§3.4).

### 5.3 Group C — Cross-check of the empirical write-mechanism findings

This is the group where the two reports diverge most sharply, and it is
escalated in full in §2. Summarized here for completeness.

| Finding under test | Report A | Report B | Verdict |
|---|---|---|---|
| No CSRF token in the observed forms | **Confirmed, strongly** — three independent citations including a CSRF CVE against `start_apply.htm` itself and a CVE stating the interface implements no proper anti-CSRF tokens | **Contradicted** — claims `asus_token` is a validated token the client must actively manage | **This project's finding stands** (§2.2). B conflates an HttpOnly session cookie with a CSRF token; its own cited CVEs describe *authenticated* issues and an actively-parsed *auth* credential, neither of which establishes anti-CSRF validation. |
| Cookie-based auth | **Confirmed** — `asus_token` session cookie set by `login.cgi` | Agrees the token is set as an HttpOnly cookie at login (then argues it is insufficient) | **Confirmed by both.** The project's §1.3 inference that an unseen HttpOnly cookie carries the session is now corroborated, and the cookie is named. |
| Writes require whole-page resubmission | **Refined** — true for the `.asp`→`start_apply.htm` form path; `applyapp.cgi` accepts single-field deltas | **Contradicted** — calls the form path obsolete, demands immediate pivot | **Refined, not contradicted.** [`WRITE_PATH_CHARACTERIZATION.md`](WRITE_PATH_CHARACTERIZATION.md) §1.1 already scopes the claim to the tested form path. A's framing is correct; B's is an overstatement of the same substance. Prototype before adopting (§1.1). |
| HTTP response body untrustworthy; nvram polling is the reliable confirmation | **Confirmed as the gold standard**, with the nuance that even `applyapp.cgi`'s JSON can report success without a state change | Agrees the response body is untrustworthy; argues nvram polling being the *only* method is an artifact of the legacy path | **A better-supported.** Both agree the finding is correct for the tested path. A's caveat that the app-endpoint's JSON is *also* not authoritative is the more conservative reading and is consistent with this project's own §1.5 gotcha, where the form DOM itself resynced late. **Keep nvram polling as the canonical confirmation regardless of write endpoint.** |

**Additional agreement neither framed as a headline:** both reports
independently reconstruct the same parameter convention this project
observed live — `action_mode=apply` plus an `rc_service`/`action_script`
style restart directive. That is a clean independent confirmation of
[`WRITE_PATH_CHARACTERIZATION.md`](WRITE_PATH_CHARACTERIZATION.md) §1.2.

**New and unresolved:** possible `Referer`/`Host`/`User-Agent` validation
on some endpoints (§2.3). Raised only by B, untested by both, untested by
this project, and low-risk for a content-script architecture.

### 5.4 Group D — Broader hardware coverage risk

**Agreement.** Both identify the **firmware generation split** (388/4.0
vs 3006/5.0, SDN being 5.0-only) as the meaningful divide, and both agree
the `httpd` web layer is broadly shared across the Asuswrt ecosystem.
Both are consistent with this project's committed conclusion in
[`CROSS_GENERATION_DIFF.md`](CROSS_GENERATION_DIFF.md) §7: "The
generation split, not the stock/Merlin split, is what needs the heavier
feature-gating."

**Disagreement — SoC divergence.** Report A: SoC-level fork risk is
**low** for the web layer, because `httpd`, the CGI endpoints and the
nvram-templated `.asp` pages come from the same Asuswrt codebase
regardless of silicon; the meaningful split is firmware generation.
Report B: SoC divergence is **severe**, nvram keys controlling a
Broadcom radio "differ substantially" from MediaTek equivalents, and the
extension must either catalog hardware-specific mappings or route
everything through `appGet.cgi` hooks.

**Adjudicated, partially, in Report A's favor — with this project's own
data as the tiebreaker.**
[`LIVE_PROBE_RT-BE92U.md`](LIVE_PROBE_RT-BE92U.md) §2.1 records
`mtk_support = 0` live on the operator's Broadcom unit. That is decisive
for the structural question: **the SoC distinction is carried as a
support flag within the same `state.js` / `rc_support` feature-detection
surface this project already identified as the correct gating mechanism.**
The web layer is shared and the divergence is expressed through machinery
the plan already uses — which is Report A's position, not Report B's.

Report B's underlying concern is not baseless — driver-specific wireless
knobs (offloading, beamforming, OFDMA toggles) plausibly do carry
different nvram names across silicon vendors. But B supports this with a
single OpenWrt forum thread about an unrelated model, and it does not
establish the broad "cannot assume identical nvram strings across the
fleet" claim. **Verdict: B's concern is real but far narrower than
stated, and lands on driver-specific wireless fields rather than the
general schema.** It is also untestable here — the operator has one
Broadcom unit and no MediaTek hardware — so it stays a documented
unknown, exactly as
[`CROSS_GENERATION_DIFF.md`](CROSS_GENERATION_DIFF.md) §8.7 already
handles the absent RT-AX88U.

**Contradicted by this project's data.** Report B asserts the 228
`*_support` flags found live are "intrinsically tied to this 5.0 SDN
paradigm." They are not.
[`CROSS_GENERATION_DIFF.md`](CROSS_GENERATION_DIFF.md) §4 establishes
**213 `*_support` flags are universal across all four trees**, spanning
both generations and both firmwares; §5.4 identifies only **13** as
5.0-exclusive, and SDN is backed by exactly one of them
(`mtlancfg_support`, live value `6` per
[`LIVE_PROBE_RT-BE92U.md`](LIVE_PROBE_RT-BE92U.md) §2.1). Report B
appears to have inferred this without access to the cross-generation
comparison.

**Already-established, mis-framed as new.** Report B's "would change the
plan" item demanding firmware-aware state abstraction is a restatement of
[`CROSS_GENERATION_DIFF.md`](CROSS_GENERATION_DIFF.md) §5.1 ("Any SDN
handling in the extension is RT-BE92U-generation-only and must be
feature-gated" on `mtlancfg_support`, which is the *stock* flag, not a
Merlin marker). It is not a change to the plan; it is the plan.

**Genuinely new — Report A only.** Two additions:
- **The ROG/GT UI fork** as a DOM-takeover coverage risk (§1.6). This
  project's reports catalog the ROG surface as source-tree facts
  (`ROG_UI` in `sysdep/FUNCTION/`, `menuTree_ROG.js` diffs) but never
  flagged it as a *coverage* risk for a UI-replacement extension.
- **ExpertWiFi diverging further than SDN branding**, requiring pages and
  backend components unavailable on non-ExpertWiFi models. Consistent
  with this project's generation-split conclusion and extends it one step
  further out. No ExpertWiFi hardware is available to verify.

### 5.5 Group E — Non-legal sanity check

**They did not answer the same question, so there is little to
reconcile.**

**Report A** addressed licensing and terms directly and found **no
blocker**: Asuswrt-Merlin is GPLv2 and Asus provides Asuswrt under GPL;
nothing in either prohibits a user running a client-side tool that reads
and writes their *own* router through its existing authenticated web
interface — which is exactly what the `asusrouter` library, the Home
Assistant integrations, and a published Chrome extension already do
openly. It notes the proprietary-component restrictions (Broadcom, Trend
Micro, Tuxera) concern redistributing firmware on non-Asus hardware, not
a client talking to the UI, and that per an Asus statement installing
Merlin does not void the hardware warranty. The only housekeeping it
identifies is extension-store policy compliance — declaring and
justifying host permissions on AMO and the Chrome Web Store. That last
item is real and worth carrying to whenever packaging happens.

**Report B** did not address licensing or terms at all. Its section E
instead surfaces the **Trend Micro EULA gate** — a functional finding,
not a legal one. It is the more useful contribution of the two despite
answering a different question, and it survives scrutiny because this
project's own data corroborates it: `eula` in the live `rc_support`
string, and the `set_ASUS_NEW_EULA.cgi` / `*_ASUS_privacy_policy.cgi`
handlers present in RT-BE92U **stock**. Promoted to §1.4, with the
endpoint-name correction noted there.

**No disagreement to adjudicate** — the two reports do not overlap in
this group. Neither contradicts anything this project has established.

---

## 6. Sources

### 6.1 Relocation and attribution

Both files were **untracked** at the start of this session (confirmed via
`git status --porcelain`), so a plain filesystem move was used; no
`git mv` was required and no history exists to preserve. `RAW/` is
already gitignored at the repo root, so no gitignore change was needed.

| Now | Original filename | Original location | Attribution |
|---|---|---|---|
| `RAW/external-research/research-report-a.md` | `compass_artifact_wf-7dd3db1b-096c-50d1-a21a-11d50439f260_text_markdown.md` | `docs/` | **Not stated.** |
| `RAW/external-research/research-report-b.md` | `Asus Router UI Architecture Review.md` | `docs/` | **Not stated.** |

**Attribution method and result.** Both documents were searched for any
explicit self-identification of the producing model or tool. **Neither
contains one** — no model name, vendor name, tool name, generation
notice, or authorship statement appears in either file. The original
filenames were deliberately not treated as evidence: one is an opaque
export identifier and the other a plain descriptive title, and neither
names a model.

Observable stylistic differences exist — Report A uses inline source
attribution with verbatim quotation and closes with an explicit Caveats
section enumerating what it did *not* verify; Report B uses numbered
footnote markers against a 36-entry "Works cited" list and presents
findings with markedly higher confidence. **These are not attribution
evidence and no inference is drawn from them.** Both are recorded as
**not stated**.

### 6.2 What Report A cited

No formal bibliography; sources are named inline. Categories cited:

- **Vulnerability databases and security research** — NVD entries
  (CVE-2018-17023 quoted verbatim; CVE-2025-15101), an Atredis writeup
  (CVE-2021-32030), and an Independent Security Evaluators study of the
  RT-N56U.
- **Chrome platform documentation** — the blink-dev "Intent to Ship:
  Local network access restrictions" thread, the Chrome for Developers
  blog post "New permission prompt for Local Network Access," and a
  WebSockets Intent-to-Ship.
- **Mozilla documentation** — the Mozilla Support article "Control
  personal device and local network permissions in Firefox" (quoted, with
  an update date) and the Firefox 151 release notes.
- **Third-party client libraries** — `asusrouter` (PyPI release and its
  documentation), `vrachieru/asuswrt-api` (a method body quoted),
  `DigitallyRefined/ha-asuswrt_merlin`, `lmeulen/AsusRouterMonitor`.
- **Asuswrt / Merlin firmware source and project statements** — the
  `RTCONFIG_ROG` gate and an apply-endpoint constant for the ROG UI, a
  Merlin statement on dropping the ROG webui in the 3006 series, and a
  Merlin statement on retaining the stock interface.
- **Community** — SNBForums threads, including a quoted `fetch()` call to
  `/applyapp.cgi` and the unreleased Vue.js UI effort.
- **Vendor** — an Asus statement on warranty and Merlin.

Report A closes with an explicit four-item Caveats section stating what it
inferred rather than verified: that `asusrouter`'s internals were
confirmed from documentation and a sibling client rather than line by
line; that this project's 228 flags and write behaviours were not
independently reproduced; that Firefox's treatment of the same-origin
case is undocumented and inferred by analogy; and that `applyapp.cgi`
coverage across all views is unmapped.

### 6.3 What Report B cited

A formal numbered "Works cited" list of 36 entries. Composition:

- **Third-party clients and their issue trackers** — the `asusrouter`
  library site and GitHub repo, `ha-asusrouter`, and a specific GitHub
  issue used as the source for the `applyapp.cgi` delta-write example.
- **Firmware source repositories** — `nvram.c` and `httpd.h` from
  `RMerl/asuswrt-merlin.ng`, and `request.c` from a third-party
  `asuswrt-rt` mirror (the source of the stale EULA endpoint names — see
  §1.4).
- **Vulnerability and threat-intel sources** — an NVD entry and a Feedly
  page for CVE-2023-39780, a VulnCheck initial-access page cited for
  CVE-2023-41346, two GreyNoise Labs writeups (AyySSHush; a null-byte
  analysis), a Russian-language forum thread for CVE-2025-15101, an ISE
  study, an Atredis PDF, a Chinese-language PoC repository for
  CVE-2021-32030, and a Radboud University master's thesis on Asus remote
  management protocols.
- **Browser platform documentation** — the WICG Local Network Access
  specification, Chrome for Developers blog posts, Chrome Platform Status,
  MDN, the Mozilla Support article, the Firefox administrator policy
  reference, and the Firefox 151 release notes.
- **Vendor and press** — an Asus router knowledge-base page on
  ASUSWRT 5.0, the Asus Router App product page, and general-press or
  enthusiast articles.
- **Weak or mismatched entries** — a Stack Overflow question, an OpenWrt
  forum thread (the sole support for the SoC-nvram-divergence claim in
  §5.4), a Hacker News comment, an unrelated hardware-news tag page, an
  unrelated GitHub repository, and a "Firefox 153" article footnoted
  against a Firefox 151 claim (§3.2).

Report B includes **no caveats or limitations section**, and does not
distinguish anywhere between what it verified and what it inferred.

### 6.4 Overall assessment of the two reports

**Report A is the more reliable of the two on this material.** Where they
disagree it was adjudicated in A's favor on every question that could be
adjudicated: prior art (§4.4), the CSRF claim (§2.2), the Firefox
timeline (§3.2), `targetAddressSpace` (§3.3), and SoC divergence (§5.4).
It also states its own limits explicitly, which made its claims easier to
weigh. Only one disagreement was left unadjudicated — the Chrome
milestone details — because the claims are compatible and nothing turns
on it.

**Report B nonetheless contributed two things Report A did not**, and
both are carried forward: the EULA gate (§1.4, promoted to the top-level
list on the strength of this project's own corroborating data), and the
sharpest articulation of why the background service worker must never
proxy router requests (§1.2, §3.1). Its central escalation — the CSRF
contradiction — does not survive, and several of its supporting claims
are contradicted by this project's committed data.

**Agreement level between the two reports: substantial on findings,
sharply divergent on framing.** They independently converge on the
existence and significance of the `appGet.cgi` / `applyapp.cgi` endpoint
pair, on `asus_token` being set as a cookie at login, on the
`action_mode=apply` parameter convention, on the same-origin
content-script fetch being exempt from LNA, on Firefox having acquired an
equivalent restriction, on Shadow DOM being required, and on the firmware
generation split mattering more than the SoC split. They diverge on
whether those findings *invalidate* this project's empirical work
(A: refine and extend; B: contradict and scrap) — and on that question
the evidence, including this project's own live data, favors A.

---

## Safety scan

Both external reports and this synthesis were checked for live household
network data before writing. **Clean.** The only network-adjacent strings
present are `192.168.1.1` — an RFC1918 default gateway address already
present throughout the committed reports — and firmware version numbers.
No SSIDs, MAC addresses, hostnames, public IP addresses, keys, tokens, or
client identifiers appear in either external report or in this document.

---

*Generated 2026-07-24 from two external research reports relocated to
`RAW/external-research/`, reconciled against the four committed reports in
`docs/`. No live router was contacted during this session. Uncommitted, as
instructed.*
