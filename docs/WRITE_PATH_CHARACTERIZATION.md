# Write-Path Characterization — RT-BE92U Running Merlin (3006.102.7_2)

Live-router session against the operator's actual RT-BE92U at `192.168.1.1`,
the first and only session in this repo's history authorized to mutate live
router state. Scope was deliberately narrow: four candidate fields from
`Tools_OtherSettings.asp` ("Tweaks"), each proposed with its current value
read live first, approved individually by the operator, submitted only by
the operator's own click (never by the assistant), verified by a live
re-read, then reverted and re-verified before moving to the next candidate.
No wireless, WAN, DHCP, VPN, firewall, or firmware/reboot/reset action was
proposed or touched — see §4.

---

## 1. General write mechanism observed

### 1.1 Transport

- All four candidates submit through **one shared HTML form** on
  `Tools_OtherSettings.asp`. The form's `action` is
  `POST http://192.168.1.1/start_apply.htm`, with `target="hidden_frame"` —
  a same-origin hidden `<iframe name="hidden_frame">` already present in the
  page chrome. The top-level tab never navigates; the POST and its response
  are fully contained in the iframe.
- **Because it's one shared form, every Apply click submits every field on
  the page**, not just the one the operator changed — the TCP/UDP timeout
  fields, `ct_max`, and all three other Tweaks radio pairs
  (`http_dut_redir`, `ipv6_ns_drop`, `aae_disable_force`,
  `dhcpd_send_wpad`) all round-trip together every time. This is
  non-destructive here because the form is pre-populated from live nvram on
  page load, but it means any client replicating this write path must send
  the *current* value of every field on the page, not a delta of just the
  one field being changed, or it will silently clobber the others back to
  whatever was in the form at load time.

### 1.2 Parameter conventions

Standard Asuswrt-Merlin `apply.cgi`-family convention, confirmed live:

| Field | Observed value | Role |
|---|---|---|
| `action_mode` | `apply` | Marks this a state-changing submit |
| `action_script` | `restart_conntrack` (candidates 1–3) | Names the `rc` restart target run after nvram commit |
| `action_wait` | `5` | Client-side seconds to wait before the page assumes completion |
| `current_page` / `next_page` | `Tools_OtherSettings.asp` | Where to land after apply |
| `modified` | `0` | Unknown purpose from source alone — plausibly a change-tracking flag other pages set to `1` |

The actual nvram-backed fields are passed as plain `name=value` pairs
matching their nvram key almost exactly, with two patterns seen:
- **Direct 1:1**: `ct_max` (nvram `ct_max`), `aae_disable_force` (nvram
  `aae_disable_force`), `http_dut_redir`, `ipv6_ns_drop`,
  `dhcpd_send_wpad` — the form field name *is* the nvram key.
- **Decomposed-then-recombined**: the eight visible "TCP Timeout: …"
  boxes and two "UDP Timeout: …" boxes are individually named
  (`tcp_established`, `tcp_syn_sent`, …, `udp_assured`, `udp_unreplied`)
  but are **not** individual nvram keys — `httpApi.nvramGet()` returns
  empty strings for all of them. The router stores them as two combined
  space-separated nvram strings, `ct_tcp_timeout` (10 space-separated
  values) and `ct_udp_timeout` (2 values), and the page also submits
  `ct_tcp_timeout`/`ct_udp_timeout` as pre-joined hidden-style fields
  alongside the decomposed ones. Whether the router httpd reads the
  joined string or reconstructs it server-side from the individual
  fields was not determined — both were present in every submission
  observed, so the two paths couldn't be distinguished from the client
  side alone.

### 1.3 Session / auth

- **No CSRF token field** was found anywhere in the form (32 named fields
  enumerated for candidate 1; none resembled a token).
- Only two **non-HttpOnly** cookies were visible to page JS:
  `clock_type` and `clickedItem_tab` — neither is an auth token.
- No visible session cookie implies the session is carried by an
  **HttpOnly cookie** the browser attaches automatically to same-origin
  requests (including the hidden-iframe POST) without exposing it to page
  JavaScript. This is consistent with, but does not confirm, ordinary
  cookie-session auth — the actual `Set-Cookie` / `Cookie` headers were
  never observed (see §1.5 limitation).

### 1.4 Response format — not captured (tooling limitation, not a router finding)

The browser extension's network-request tracker (`read_network_requests`)
only surfaces top-frame XHR/Fetch/document/image traffic — background
`ajax_status.xml` polling and `appGet.cgi` reads were visible throughout,
but **the `POST /start_apply.htm` request/response itself, inside the
hidden target iframe, never appeared in the tracker on any of the four
submissions.** `performance.getEntriesByType('resource')` in the top
document also does not surface a same-origin iframe's own top-level
navigation (this is standard browser behavior, not specific to this
router). Reading `hidden_frame.contentDocument.body` immediately after
each submit found it empty (`bodyLen: 0`), consistent with the response
being a minimal/redirect document that had already been navigated past by
the time it was read, or with the iframe's post-apply reload landing back
on a page whose body renders effectively empty.

**Net effect: this session characterizes the request (from the DOM form
contents) and confirms outcomes (from live nvram reads), but cannot
speak to the actual HTTP response** — status code, headers, or body —
**for any of the four submissions.** A future session with a proper
HTTP-level proxy or `chrome.debugger`-class access (rather than this
extension's page-level network tracker) would be needed to close that
gap.

### 1.5 Verification method / a real gotcha

- The reliable ground truth was `httpApi.nvramGet(keys, true)` — the
  `true` second argument forces a live re-read rather than returning a
  cached value.
- **The visible form DOM is not trustworthy immediately after a submit.**
  On multiple candidates, reading the form's input values 1–2 tool-calls
  after the operator's click showed the *pre-submit* value still (or
  again) present, before silently resyncing to the true post-apply value
  moments later. Anyone scripting against this page must poll the nvram
  read path, not the form fields, to confirm a write landed.

### 1.6 Timing / connectivity impact

- No measurable disruption: a lightweight `nvramGet(["productid"], true)`
  round-trip taken immediately after every revert consistently returned in
  14–16ms, and the page's own background `ajax_status.xml` polling
  continued uninterrupted through all eight submissions (4 applies + 4
  reverts).

### 1.7 Client-side validation observed

- `ct_max` enforces a range of **256–300000** before allowing submission —
  discovered when the operator's browser rejected an out-of-range test
  value (`300010`) with an inline message, before any request was sent.
  The candidate was adjusted to `299990` (in-range) to actually exercise
  the write path.

---

## 2. Per-candidate detail

### 2.1 Candidate 1 — TCP Timeout: close (`ct_tcp_timeout`, decomposed field `tcp_close`)

| | |
|---|---|
| Baseline (Task 1, live) | `ct_tcp_timeout` = `"0 2400 120 60 120 120 10 60 30 0"` (close = `10`) |
| Test value | close → `20` |
| Post-apply live read | `ct_tcp_timeout` = `"0 2400 120 60 120 120 20 60 30 0"` — **confirmed applied** |
| `action_script` observed | `restart_conntrack` |
| Revert | close → `10` |
| Post-revert live read | `ct_tcp_timeout` = `"0 2400 120 60 120 120 10 60 30 0"` — **confirmed reverted, exact match to baseline** |
| Connectivity after | Normal (15ms) |

### 2.2 Candidate 2 — UDP Timeout: Unreplied (`ct_udp_timeout`, decomposed field `udp_unreplied`)

| | |
|---|---|
| Baseline (Task 1, live) | `ct_udp_timeout` = `"30 180"` (unreplied = `30`) |
| Test value | unreplied → `40` |
| Post-apply live read | `ct_udp_timeout` = `"40 180"` — **confirmed applied** |
| `action_script` observed | `restart_conntrack` |
| Revert | unreplied → `30` |
| Post-revert live read | `ct_udp_timeout` = `"30 180"` — **confirmed reverted, exact match to baseline** |
| Connectivity after | Normal (14ms) |

### 2.3 Candidate 3 — TCP connections limit (`ct_max`)

| | |
|---|---|
| Baseline (Task 1, live) | `ct_max` = `300000` |
| First attempted test value | `300010` — **rejected client-side**, "Please enter a value between 256 to 300000" (no request sent) |
| Revised test value | `299990` (in-range) |
| Post-apply live read | `ct_max` = `299990` — **confirmed applied** |
| `action_script` observed | `restart_conntrack` |
| Revert | `300000` |
| Post-revert live read | `ct_max` = `300000` — **confirmed reverted, exact match to baseline** |
| Connectivity after | Normal (14ms) |

### 2.4 Candidate 4 — Disable Asusnat tunnel (`aae_disable_force`)

| | |
|---|---|
| Baseline (Task 1, live) | `aae_disable_force` = `0` (No / tunnel enabled) |
| Test value | `1` (Yes / disabled) |
| Post-apply live read | `aae_disable_force` = `1` — **confirmed applied**; the other three radio fields (`http_dut_redir`, `ipv6_ns_drop`, `dhcpd_send_wpad`) unaffected |
| `action_script` observed | `restart_conntrack` in the post-hoc DOM read — **not trusted**, per the §1.5 staleness gotcha; this may be a leftover from a prior candidate's Apply rather than the script actually used for this field. **Left as an open unknown** — the real `action_script` for this field was not reliably captured. |
| Revert | `0` |
| Post-revert live read | `aae_disable_force` = `0`, and all other fields (`http_dut_redir`, `ipv6_ns_drop`, `dhcpd_send_wpad`, `ct_max`, `ct_tcp_timeout`, `ct_udp_timeout`) simultaneously re-checked and confirmed still at their original baseline values — **confirmed reverted** |
| Connectivity after | Normal (16ms) |

---

## 3. Open items from this session

1. **No response body/headers/status for any submission** (§1.4) — needs a
   session with HTTP-level capture, not page-level.
2. **`action_script` for `aae_disable_force` unconfirmed** (§2.4) — the
   value read post-hoc is not trusted due to DOM staleness.
3. **Whether `ct_tcp_timeout`/`ct_udp_timeout` (joined) or the decomposed
   `tcp_*`/`udp_*` fields are what the server actually parses** (§1.2) is
   unresolved — both are sent together on every submit.
4. **`modified` field's purpose** (§1.2) is unconfirmed from source alone.

---

## 4. Session 2 — Wireless: Push-Button Pairing (WPS), 2026-07-31

Different in kind from Session 1: that session reverse-engineered the
**native page's** own write transport from scratch (no extension def
existed yet). This session exercised **this extension's own already-
implemented** write path for the first time against live hardware —
`src/pages/defs/wireless.ts`'s `wpsPage`, whose `writeExclusion` was
lifted for this one page only, for this one field, after the operator
explicitly chose to proceed (see `DECISIONS.md` D-022). Every write was
submitted by the operator's own click, through the extension's normal
Apply flow (read-only mode was already off going in, so both submissions
were real, not dry-run previews) — never scripted or clicked by the
assistant.

### 4.1 Transport confirmed

- `POST /applyapp.cgi`, `action_mode=apply`, `rc_service=restart_wireless`
  — matches this project's settled architecture decision ("applyapp.cgi
  delta writes for every settings page," `STATUS.md`), and unlike Session
  1's native-page shared-whole-form behavior, **the payload was a true
  delta**: only `wps_enable` was posted, not the untouched `wps_band_x` —
  confirming the delta-write design holds in practice for this page, not
  just in source-code theory.
- Response: `200 { "modify": "1", "run_service": "restart_wireless" }` on
  both submissions. Per this project's own stated policy, the response
  body was **not trusted as confirmation** — the extension's built-in
  `verifyNvram` mechanism (forced-fresh nvram re-read; 3000ms settle wait
  per the page's `actionWait`, 30000ms ceiling, 800ms poll) supplied the
  actual ground truth, and is itself what this session verifies as
  working correctly for the first time against live hardware.

### 4.2 Per-field detail

| | Disable (1→0) | Enable (0→1) |
|---|---|---|
| Payload | `wps_enable=0` | `wps_enable=1` |
| Response | `200 {"modify":"1","run_service":"restart_wireless"}` | `200 {"modify":"1","run_service":"restart_wireless"}` |
| Live nvram re-read | `wps_enable = "0"` — **confirmed**, 3149ms into the 30000ms window | `wps_enable = "1"` — **confirmed**, 3182ms into the 30000ms window |
| Connectivity impact | Wi-Fi clients disconnected/reconnected (`restart_wireless`), matching native's own behavior for the same action — operator-confirmed | Same, operator-confirmed |

`wps_band_x` (the band selector) was **not** touched or tested — the
operator's session covered `wps_enable` only. This field remains
unverified; see `OPEN_LOOPS.md`.

### 4.3 Open items from this session

1. **`wps_band_x` remains untested.** `wpsPage.confidence.write` is
   deliberately left `'unverified-write'` rather than `'live-verified'`
   for this reason — see the inline comment in `wireless.ts`.
2. **Every other wireless page stays hard-excluded.** This session
   verified one field's write mechanism (endpoint, delta behavior,
   verification timing) on the RT-BE92U; it says nothing about SSID,
   security, channel, MAC-filter, RADIUS, WDS, or the Professional page's
   fields, several of which carry materially higher blast radius (see
   `OPEN_LOOPS.md`'s "Wireless-general SSID semantics on SDN units").

---

## 4. Excluded categories — explicitly unresolved, carried forward

The following were **hard-excluded from this session by the operator's own
scoping** and were not proposed, tested, or touched in any way. Nothing in
this document should be read as implying they share the same mechanics as
the four candidates above — **Fable should treat write actions in every one
of these categories defensively**, re-deriving the actual mechanism from a
dedicated, narrowly-scoped session before assuming `action_mode=apply` /
`action_script=restart_*` / hidden-iframe-POST behavior generalizes to
them:

- **Wireless settings** (SSID, password, channel, band, radio state) — risk
  of disconnecting the session running the test.
- **WAN configuration.**
- **DHCP server configuration** — this excluded `dhcpd_send_wpad` (present
  on the same page as the four tested candidates, but explicitly out of
  scope).
- **VPN configuration** (client or server).
- **Firewall rules** — this excluded `ipv6_ns_drop` (present on the same
  page, explicitly labeled "Firewall:" in the UI, and explicitly out of
  scope).
- **Firmware upgrade, reboot, factory reset, or any reset-to-default
  action.**
- **Any action whose `action_script` touches `restart_net_and_phy`,
  `restart_wireless`, `restart_wan`, or `restart_dhcpd`** — treated as
  excluded by policy even where source is unclear, per the operator's own
  "if unclear, treat as excluded" instruction.
- **`http_dut_redir`** (Redirect webui access to www.asusrouter.com) — a
  fifth Task 1 candidate that was **dropped by mutual agreement** before
  any testing, on the grounds that redirecting the WebUI carries the same
  category of session-continuity risk the wireless exclusion is written to
  avoid, and its revert path if it went wrong was unverified from source
  alone.
- **SSH forwarding, HTTPS certificate regeneration, SMB protocol, UPnP
  pinhole** — explicitly named by the operator as further fields to not
  propose as candidates, same rationale.

---

*Generated from a live, staged-approval browser session against the
operator's RT-BE92U at `192.168.1.1`, 2026-07-24. Every write in this
document was submitted by the operator's own click, never by the
assistant; all four tested values were verified live and confirmed
reverted to their exact original baseline before the session ended.
Uncommitted, as instructed.*

---

## 5. Addendum — `applyapp.cgi` delta-write verification, 2026-07-24

A second live session, same day, same operator-executes-every-write
discipline as §0–§4, this time run entirely through the browser
console rather than the page's own form UI. Scope: exactly one field,
`aae_disable_force`, reusing the baseline/test/revert values already
established in §2.4. The only new variable was which endpoint received
the write. Motivated by
[`EXTERNAL_RESEARCH_RECONCILIATION.md`](EXTERNAL_RESEARCH_RECONCILIATION.md)
§1.1, which flagged `applyapp.cgi` as an external-research claim,
corroborated only by the read-side `appGet.cgi` traffic already seen in
[`LIVE_PROBE_RT-BE92U.md`](LIVE_PROBE_RT-BE92U.md) §5, but with the
write half entirely unverified against this hardware until now.

### 5.1 Baseline (forced-fresh nvram read, before any write)

`aae_disable_force` = `0`, `ct_max` = `300000`,
`ct_tcp_timeout` = `"0 2400 120 60 120 120 10 60 30 0"`,
`ct_udp_timeout` = `"30 180"` — identical on every field to the §2
baseline recorded in the prior session. No drift between sessions.

### 5.2 Command used (apply)

Pasted into the browser console by the operator, against the
already-authenticated `192.168.1.1` origin:

```javascript
fetch('/applyapp.cgi', {method:'POST', credentials:'same-origin', headers:{'Content-Type':'application/x-www-form-urlencoded'}, body:'action_mode=apply&aae_disable_force=1'}).then(r=>r.text()).then(t=>console.log('APPLYAPP RESPONSE:', t));
```

Only two body parameters were sent — `action_mode=apply` and
`aae_disable_force=1` — no other field from the Tweaks page was
included, unlike the whole-page `start_apply.htm` submission
characterized in §1.1.

**Response text, verbatim, logged by the fetch's own `.then()`:**

```
{ "modify": "1" }
```

This is the first time this project has captured an actual HTTP
response body for a router write — §1.4 records that the
`start_apply.htm` hidden-iframe path never surfaced a response to any
tool used in the prior session. `applyapp.cgi` responds directly on the
page's own fetch promise chain, with no iframe indirection, so the
response was visible without any special capture tooling.

### 5.3 Post-apply live verification (forced-fresh nvram read)

| Field | Before | After apply | Changed? |
|---|---|---|---|
| `aae_disable_force` | `0` | `1` | **Yes — confirmed applied** |
| `ct_max` | `300000` | `300000` | No |
| `ct_tcp_timeout` | `"0 2400 120 60 120 120 10 60 30 0"` | `"0 2400 120 60 120 120 10 60 30 0"` | No |
| `ct_udp_timeout` | `"30 180"` | `"30 180"` | No |

**Delta-write claim: confirmed.** Exactly the targeted field changed;
the other three fields — which the §1.1 whole-page form path would have
round-tripped and potentially clobbered — were untouched, byte-for-byte
identical to their pre-write values.

### 5.4 Command used (revert)

```javascript
fetch('/applyapp.cgi', {method:'POST', credentials:'same-origin', headers:{'Content-Type':'application/x-www-form-urlencoded'}, body:'action_mode=apply&aae_disable_force=0'}).then(r=>r.text()).then(t=>console.log('APPLYAPP REVERT RESPONSE:', t));
```

**Response text, verbatim:**

```
{ "modify": "1" }
```

Identical response shape/text to the apply call — the response does not
appear to encode which direction the value moved, only that a
modification was accepted. Consistent with §5.6's observation below
that this response is not a reliable indicator of resulting state on
its own.

### 5.5 Post-revert live verification (forced-fresh nvram read)

`aae_disable_force` = `0`, `ct_max` = `300000`,
`ct_tcp_timeout` = `"0 2400 120 60 120 120 10 60 30 0"`,
`ct_udp_timeout` = `"30 180"` — **confirmed reverted, exact match to
the §5.1 baseline**, all four fields simultaneously re-checked.

### 5.6 Connectivity after revert

Normal (13ms), consistent with the 14–16ms range observed after every
apply/revert pair in the prior session (§1.6).

### 5.7 Assessment

- **The external-research delta-write claim
  ([`EXTERNAL_RESEARCH_RECONCILIATION.md`](EXTERNAL_RESEARCH_RECONCILIATION.md)
  §1.1) is confirmed live against this exact RT-BE92U, for this one
  field.** `applyapp.cgi` accepted a two-parameter body
  (`action_mode` + the single target field) and applied only that
  field, leaving the other three Tweaks-page fields untouched — the
  clobber hazard inherent to the `start_apply.htm` whole-page path
  (§1.1) does not apply to this endpoint, at least for this field.
- **This does not generalize on its own.** One field, one page, one
  session. §1.1's own caveat stands: coverage of `applyapp.cgi` across
  other settings categories remains unmapped, and per §4 the hard
  exclusions (wireless, WAN, DHCP, VPN, firewall, firmware/reboot/reset)
  were not touched by this endpoint either.
- **The `{ "modify": "1" }` response is a bare acknowledgment, not a
  value echo or a status code.** Both the apply and the revert produced
  the identical string despite moving the field in opposite directions.
  Per
  [`EXTERNAL_RESEARCH_RECONCILIATION.md`](EXTERNAL_RESEARCH_RECONCILIATION.md)
  §5.3's carried-forward conclusion, this keeps live `nvramGet(..., true)`
  polling as the canonical confirmation method regardless of which write
  endpoint is used — this session's own data reinforces that point
  rather than superseding it.
- The `Referer`/`Host`/`User-Agent` validation question raised in
  [`EXTERNAL_RESEARCH_RECONCILIATION.md`](EXTERNAL_RESEARCH_RECONCILIATION.md)
  §2.3 remains open — this session's fetch was same-origin page JS, so
  it says nothing about whether those headers are enforced elsewhere.

---

*Addendum generated from a second live, staged-approval browser console
session against the operator's RT-BE92U at `192.168.1.1`, 2026-07-24,
same day and same operator as the session above. Both writes in this
addendum were submitted by the operator pasting and running the command
themselves, never by the assistant; the tested value was verified live
and confirmed reverted to its exact original baseline before the
session ended. Uncommitted, as instructed.*
