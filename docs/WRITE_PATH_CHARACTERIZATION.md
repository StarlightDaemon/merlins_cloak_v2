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
