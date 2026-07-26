# Write-path verification protocols

Per-path preparation material for supervised live-write sessions. **Documentation
only.** Nothing here authorises, schedules, or recommends a session; the decision
to run one, and the running of it, belongs to the operator.

Every fact in these files was re-derived from source in this repo and
cross-checked against `STATUS.md`, `CHANGELOG.md`, and `docs/`. Where a
document's claim did not survive that check, it is marked as such rather than
repeated.

---

## Inventory as derived from source

| | Count | Source of the count |
| --- | --- | --- |
| `write:` blocks in `src/pages/defs/*` | 46 | one per settings def; enumerated below |
| `guardedWrite()` call sites in custom components | 3 | 2 in [wol.tsx](../../src/pages/defs/wol.tsx) (list save, wake), 1 in [site-survey.tsx](../../src/pages/defs/site-survey.tsx) (rescan) |
| **Total write paths** | **49** | |
| Already live-verified — excluded from protocol work | 1 | `tweaks`, `confidence: { write: 'live-verified' }` at [tools-tweaks.ts:52](../../src/pages/defs/tools-tweaks.ts:52) |
| **Protocols in this directory** | **48** | 18 + 5 + 9 + 16 |
| `writeExclusion`-tagged defs with **no** write block | 3 | `firmware`, `backup`, `vpn-fusion` — see below |

This derivation matches `CHANGELOG.md` ("49 implemented, 1 live-verified, 48
never submitted"), `README.md`, and `docs/GETTING_STARTED.md`. `STATUS.md`
§build-status says "46 settings-page write paths implemented (plus WOL wake and
Site Survey rescan actions)" — reading as 48 — because that sentence omits the
WOL **list-save** write. `STATUS.md` reaches 49 correctly elsewhere. The 49 / 1 /
48 figures are the accurate ones.

---

## Wave order and purpose

Waves are numbered by category, not by recommended sequence. Where the material
suggests an ordering it is because of what a wave can and cannot reach, not
because of any schedule.

| Wave | File | Protocols | Purpose |
| --- | --- | --- | --- |
| 1 | [wave-1-vpn-firewall.md](wave-1-vpn-firewall.md) | 18 | All `vpn`-tagged (7) and `firewall`-tagged (11) paths. Both categories are **hard-blocked in code**; these protocols describe sessions that cannot execute as the source stands. |
| 2 | [wave-2-disruptive.md](wave-2-disruptive.md) | 5 | The `firmware-reboot-reset` and `excluded-restart` paths that carry a write block. **Not** hard-blocked — reachable once read-only mode is off. Every one reboots or restarts the network stack. |
| 3 | [wave-3-core-connectivity.md](wave-3-core-connectivity.md) | 9 | All `dhcp` (1), `wan` (2) and `wireless` (6) paths. Hard-blocked in code. Wireless additionally carries the unresolved band-token question. |
| 4 | [wave-4-routine.md](wave-4-routine.md) | 16 | Every remaining untagged path. Governed only by the read-only interlock. The shortest route from "never submitted" to evidence, and incidentally the only test of whether the project's `applyapp.cgi` delta-write policy generalises beyond the one field it has been proven on. |

**Hard-block note.** `wireless`, `wan`, `dhcp`, `vpn`, `firewall` are refused
unconditionally at the write chokepoint, ahead of and independently of the
read-only interlock ([write-policy.ts:46](../../src/lib/write-policy.ts:46);
[write-guard.ts:110-116](../../src/lib/write-guard.ts:110)). Turning read-only
mode off does not reach them. Waves 1 and 3 are prep for sessions that require the
operator to clear the corresponding category first. Nothing in this directory
proposes doing so or argues for it.

---

## The three exclusions with no write path

These carry a `writeExclusion` tag but have **no `write:` block at all**, so
there is nothing to protocol. Status recorded here for completeness.

| Def | File | Tag | Status |
| --- | --- | --- | --- |
| `firmware` | [admin.ts:593](../../src/pages/defs/admin.ts:593) | `firmware-reboot-reset` | **Read-only view.** `confidence: { read: 'live-verified' }` with no `write` key. Firmware check / download / upgrade, AiMesh node upgrade and Merlin's manual `.zip` upload are deliberately not implemented — they apply via reboot/flash. The view shows current version and last update-check status only. |
| `backup` | [admin.ts:648](../../src/pages/defs/admin.ts:648) | `firmware-reboot-reset` | **Read-only view.** `confidence: { read: 'live-verified' }` with no `write` key. Factory reset, `.CFG` save/upload and JFFS backup/restore are button and file-upload actions (`upload.cgi` / `apply.cgi action_mode=Restore`), not plain nvram writes, and apply via reboot. The view reports `jffs2_on` only. |
| `vpn-fusion` | [vpn-client.ts:621](../../src/pages/defs/vpn-client.ts:621) | `vpn` | **Read-only by design.** No `write` key. `vpnc_clientlist` is a 12-field record whose "server" column means different things per protocol, paired with a second positionally-aligned key `vpnc_pptp_options_x_list`, and default-WAN state comes from a hook rather than an nvram key. The def's own reasoning: too protocol-entangled to model as a safely round-trippable list. Profiles are managed from the native page; per-unit OpenVPN/WireGuard settings remain editable via `openvpn-client` / `wireguard-client`. |

---

## Checklist — 48 protocols

Fill the **Verified** column during actual sessions. Leave it blank until a
forced-fresh nvram re-read has confirmed both the write *and* the rollback.

### Wave 1 — VPN and firewall (18)

| # | Def | File:line | Tag | Verified |
| --- | --- | --- | --- | --- |
| 1 | `ipsec-server` | [ipsec.ts:335](../../src/pages/defs/ipsec.ts:335) | `vpn` | |
| 2 | `openvpn-client` | [vpn-client.ts:397](../../src/pages/defs/vpn-client.ts:397) | `vpn` | |
| 3 | `wireguard-client` | [vpn-client.ts:558](../../src/pages/defs/vpn-client.ts:558) | `vpn` | |
| 4 | `vpn-director` | [vpn-director.ts:82](../../src/pages/defs/vpn-director.ts:82) | `vpn` | |
| 5 | `openvpn-server` | [vpn-server.ts:477](../../src/pages/defs/vpn-server.ts:477) | `vpn` | |
| 6 | `wireguard-server` | [vpn-server.ts:568](../../src/pages/defs/vpn-server.ts:568) | `vpn` | |
| 7 | `pptp-server` | [vpn-server.ts:684](../../src/pages/defs/vpn-server.ts:684) | `vpn` | |
| 8 | `aiprotection` | [aiprotection.ts:92](../../src/pages/defs/aiprotection.ts:92) | `firewall` | |
| 9 | `firewall-general` | [firewall.ts:154](../../src/pages/defs/firewall.ts:154) | `firewall` | |
| 10 | `url-filter` | [firewall.ts:263](../../src/pages/defs/firewall.ts:263) | `firewall` | |
| 11 | `keyword-filter` | [firewall.ts:333](../../src/pages/defs/firewall.ts:333) | `firewall` | |
| 12 | `network-service-filter` | [firewall.ts:494](../../src/pages/defs/firewall.ts:494) | `firewall` | |
| 13 | `ipv6-firewall` | [firewall.ts:592](../../src/pages/defs/firewall.ts:592) | `firewall` | |
| 14 | `parental` | [parental.ts:162](../../src/pages/defs/parental.ts:162) | `firewall` | |
| 15 | `port-trigger` | [wan.ts:439](../../src/pages/defs/wan.ts:439) | `firewall` | |
| 16 | `port-forwarding` | [wan.ts:546](../../src/pages/defs/wan.ts:546) | `firewall` | |
| 17 | `dmz` | [wan.ts:600](../../src/pages/defs/wan.ts:600) | `firewall` | |
| 18 | `nat-passthrough` | [wan.ts:780](../../src/pages/defs/wan.ts:780) | `firewall` | |

### Wave 2 — Disruptive (5)

| # | Def | File:line | Tag | Verified |
| --- | --- | --- | --- | --- |
| 1 | `switch-ctrl` | [lan.ts:362](../../src/pages/defs/lan.ts:362) | `firmware-reboot-reset` | |
| 2 | `lan-ip` | [lan.ts:68](../../src/pages/defs/lan.ts:68) | `excluded-restart` | |
| 3 | `static-route` | [lan.ts:229](../../src/pages/defs/lan.ts:229) | `excluded-restart` | |
| 4 | `iptv` | [lan.ts:326](../../src/pages/defs/lan.ts:326) | `excluded-restart` | |
| 5 | `ipv6` | [ipv6.ts:391](../../src/pages/defs/ipv6.ts:391) | `excluded-restart` | |

### Wave 3 — Core connectivity (9)

| # | Def | File:line | Tag | Verified |
| --- | --- | --- | --- | --- |
| 1 | `dhcp` | [lan.ts:174](../../src/pages/defs/lan.ts:174) | `dhcp` | |
| 2 | `wan` | [wan.ts:233](../../src/pages/defs/wan.ts:233) | `wan` | |
| 3 | `dual-wan` | [wan.ts:354](../../src/pages/defs/wan.ts:354) | `wan` | |
| 4 | `wireless-general` | [wireless.ts:248](../../src/pages/defs/wireless.ts:248) | `wireless` | |
| 5 | `wps` | [wireless.ts:288](../../src/pages/defs/wireless.ts:288) | `wireless` | |
| 6 | `wds` | [wireless.ts:351](../../src/pages/defs/wireless.ts:351) | `wireless` | |
| 7 | `wireless-macfilter` | [wireless.ts:407](../../src/pages/defs/wireless.ts:407) | `wireless` | |
| 8 | `radius` | [wireless.ts:455](../../src/pages/defs/wireless.ts:455) | `wireless` | |
| 9 | `wireless-professional` | [wireless.ts:591](../../src/pages/defs/wireless.ts:591) | `wireless` | |

### Wave 4 — Routine (16)

| # | Def | File:line | Tag | Verified |
| --- | --- | --- | --- | --- |
| 1 | `system` | [admin.ts:353](../../src/pages/defs/admin.ts:353) | none | |
| 2 | `system-time` | [admin.ts:470](../../src/pages/defs/admin.ts:470) | none | |
| 3 | `ssh` | [admin.ts:545](../../src/pages/defs/admin.ts:545) | none | |
| 4 | `dns-director` | [dnsdirector.ts:213](../../src/pages/defs/dnsdirector.ts:213) | none | |
| 5 | `qos` | [qos.ts:206](../../src/pages/defs/qos.ts:206) | none | |
| 6 | `qos-rules` | [qos.ts:332](../../src/pages/defs/qos.ts:332) | none | |
| 7 | `bandwidth-limiter` | [qos.ts:444](../../src/pages/defs/qos.ts:444) | none | |
| 8 | `samba` | [usb.ts:159](../../src/pages/defs/usb.ts:159) | none | |
| 9 | `ftp` | [usb.ts:237](../../src/pages/defs/usb.ts:237) | none | |
| 10 | `mediaserver` | [usb.ts:369](../../src/pages/defs/usb.ts:369) | none | |
| 11 | `nfs` | [usb.ts:459](../../src/pages/defs/usb.ts:459) | none | |
| 12 | `ddns` | [wan.ts:712](../../src/pages/defs/wan.ts:712) | none | |
| 13 | `traffic-settings` | [traffic.tsx:363](../../src/pages/defs/traffic.tsx:363) | none | |
| 14 | `wol` — list save | [wol.tsx:72](../../src/pages/defs/wol.tsx:72) | none | |
| 15 | `wol` — wake action | [wol.tsx:49](../../src/pages/defs/wol.tsx:49) | none | |
| 16 | `site-survey` — rescan | [site-survey.tsx:89](../../src/pages/defs/site-survey.tsx:89) | none | |

### Excluded — already live-verified

| Def | File:line | Status |
| --- | --- | --- |
| `tweaks` | [tools-tweaks.ts:132](../../src/pages/defs/tools-tweaks.ts:132) | `write: 'live-verified'`. **But see the caveat below** — the claim is narrower than the page-level tier suggests. |

---

## Confirmation timing: what `confirmWindow()` actually does

Two findings used to apply to every protocol in this directory: that
`actionWait` was inert everywhere, and that the verifier's ceiling was a fixed,
unreachable 10 seconds. Both were true when first written and both were fixed
in this codebase since; the current behavior, re-derived from source, replaces
them.

**1. `actionWait` now drives the confirmation window — it is not inert.**
`buildWriteRequest()` still never puts `action_wait` on the wire on the
`applyapp` branch ([router-io.ts:215-226](../../src/lib/router-io.ts:215));
only `start_apply` sends it as a form field
([router-io.ts:231](../../src/lib/router-io.ts:231)), and every def in this
project uses `endpoint: 'applyapp'`. That part hasn't changed. What changed is
that the value is no longer merely a transcription for the operator's own
timer: `guardedWrite()` now passes each write's `actionWait` (together with its
`writeExclusion` category and any `confirmTimeoutMs` override) into
`confirmWindow()` ([write-guard.ts:135](../../src/lib/write-guard.ts:135);
[write-policy.ts:161-179](../../src/lib/write-policy.ts:161)), which resolves
the actual `settleMs` (the delay before the first forced-fresh read) directly
from it, and factors it into the ceiling as `max(settleMs * 2, categoryCeiling)`.
So `switch-ctrl`'s `actionWait: 120` and `dual-wan`'s `actionWait: 70` now
control how long the built-in verifier itself waits, not just how long an
operator should wait by hand.

**2. The verifier's ceiling now scales per path; it is no longer a fixed
10 seconds.** `verifyNvram()`'s own defaults are still `timeoutMs: 10000` /
`intervalMs: 800` ([router-io.ts:321-322](../../src/lib/router-io.ts:321)), but
`guardedWrite()` no longer calls it with no options — it always supplies the
window `confirmWindow()` resolves
([write-guard.ts:135-139](../../src/lib/write-guard.ts:135)), so those bare
defaults never apply on any of the 49 write paths in this project. The ceiling
is looked up per `writeExclusion` category
([write-policy.ts:131-140](../../src/lib/write-policy.ts:131)) — 30 s for an
untagged write, up to 180 s for `firmware-reboot-reset` — then widened further
if `settleMs * 2` exceeds it, capped overall at 300 s
([write-policy.ts:146](../../src/lib/write-policy.ts:146)). Each protocol below
states its path's resolved settle/ceiling figures.

Read failures that happen *during* the confirmation window no longer abort it:
`verifyNvram()` records them and keeps polling until a matching read lands or
the budget is exhausted
([router-io.ts:346-380](../../src/lib/router-io.ts:346)) — expected on any
restart-bearing path, since the router is briefly unreachable while a service
or the box itself comes back. The one exception is a **lost session**
(`RouterAuthError`, i.e. the router redirected to its login page mid-window):
that stops the loop immediately and is reported honestly as a lost-session
error, never as a false confirm
([router-io.ts:360-365](../../src/lib/router-io.ts:360)). This leaves two
distinct unconfirmed outcomes worth telling apart:

- **unknown** — `reads === 0`: the router never answered inside the window at
  all (`detail` is empty). This says nothing about whether the write landed.
- **mismatched** — `reads > 0` but `verified === false`: the router did
  answer, and `detail[key]` shows the actual value differing from what was
  expected — a real signal, not silence.

`SENT (unconfirmed)` in the UI still covers both cases; the write log's
`VerifyResult.reads`/`.detail` is what distinguishes them.

---

## Paths with conflicting or insufficient documentation

Flagged separately, as requested. These may need operator input **before their
session is planned**, not merely before the write. Grouped by what kind of gap it
is.

### A. A protocol whose smallest test rests on an unconfirmed key name

- **`ddns` (Wave 4 #12).** The def's field — and this protocol's recommended
  smallest test — is `ddns_regular_check`
  ([wan.ts:631](../../src/pages/defs/wan.ts:631)).
  `docs/STOCK_VS_MERLIN_DIFF.md` names the Merlin periodic-refresh key on this
  page `ddns_refresh_x`, and the def's own intro says the `ddns_refresh_x` row is
  permanently `display:none` and not modelled
  ([wan.ts:620-621](../../src/pages/defs/wan.ts:620)). They may be two different
  controls, or the def may have the wrong name. **Confirm `ddns_regular_check`
  appears in the baseline read before planning a session around it.**

### B. Paths where no genuinely small test exists under some baseline states

Each is conditional on what the router is actually running; the condition is
stated in the protocol.

- **`parental` (Wave 1 #14)** — if any client rules exist at baseline. Every list
  edit rewrites all four parallel `MULTIFILTER_*` keys at once, and the only
  scalar is the master enable.
- **`port-forwarding` (Wave 1 #16)** — if any forwarding rules exist at baseline.
  The only non-list field is `vts_enable_x`, and flipping it activates or
  deactivates every stored rule.
- **`dmz` (Wave 1 #17)** — if `dmz_ip` is blank at baseline. There is no
  `dmz_enable` key; the only available change is to expose a host.
- **`ipv6` (Wave 2 #5)** — if `ipv6_service` is `disabled`. The only rendered
  field is `ipv6_service` itself, and changing it turns IPv6 on.
- **`wds` (Wave 3 #6)** — if `wlB_mode_x` is `0` (AP Only, the normal case). The
  only rendered field is `wlB_mode_x`, and changing it puts the radio into a
  bridging mode.

### C. Unresolved contradictions between the code and the docs, or between docs

- **`system` / `ssh` restart script.** Both send
  `restart_time;restart_httpd;restart_upnp`
  ([admin.ts:358](../../src/pages/defs/admin.ts:358),
  [admin.ts:551](../../src/pages/defs/admin.ts:551)).
  `docs/STOCK_VS_MERLIN_DIFF.md` records stock as `restart_time;restart_upnp;`
  and Merlin as `restart_time;restart_leds;`. **The shipped string matches
  neither**, and the def itself notes the native page reconstructs the value
  dynamically per changed field. What actually runs on apply is unknown.
- **`dns-director` restart script.** Def sends `restart_dnsfilter`
  ([dnsdirector.ts:215](../../src/pages/defs/dnsdirector.ts:215));
  `docs/STOCK_VS_MERLIN_DIFF.md` records `restart_dnsmasq`. Different disruption
  profiles — the second briefly interrupts LAN DNS, the first may not.
- **`ftp` restart script.** Def sends `restart_ftpsamba`
  ([usb.ts:239](../../src/pages/defs/usb.ts:239));
  `docs/STOCK_VS_MERLIN_DIFF.md` lists a Merlin `restart_ftpd`. Unreconciled.
- **`wan` restart script.** Def sends `restart_wan_if`
  ([wan.ts:235](../../src/pages/defs/wan.ts:235));
  `docs/WRITE_PATH_CHARACTERIZATION.md` §4 names `restart_wan` in its exclusion
  list. Different literals, no doc reconciles them.
- **`ssh` — `sshd_authkeys` provenance.** `docs/CURRENT_STATE_AUDIT.md` models it
  as a live Merlin key; `docs/STOCK_VS_MERLIN_DIFF.md` classes it as stock-only
  naming, "check before use".
- **`ipsec-server` — client-list shards.** `docs/CURRENT_STATE_AUDIT.md` models
  `ipsec_client_list_1` / `_2` as live Merlin reads;
  `docs/STOCK_VS_MERLIN_DIFF.md` classes `ipsec_client_list_{1..5}` as stock-only
  keys that "almost none apply to this hardware".
- **`wol` — `wollist` encoding.** `docs/CURRENT_STATE_AUDIT.md` §wol describes it
  as **both** "plain nvram" and "nvram(ascii)" in the same row. The code splits
  the difference: it *reads* via `nvram_char_to_ascii`
  ([wol.tsx:32](../../src/pages/defs/wol.tsx:32)) and *verifies* via plain
  `nvram_get` ([router-io.ts:274](../../src/lib/router-io.ts:274)). A name
  containing a character the two paths treat differently produces a verification
  mismatch that is a read-path artefact, not a failed write.

### D. Paths where the mechanism itself is unconfirmed

- **`wireguard-server` (Wave 1 #6).** `docs/CURRENT_STATE_AUDIT.md` records that
  **no confirmed `validate_instance()` branch exists** for direct `wgs1_*` writes
  bypassing the native page's unit-selector indirection; `STATUS.md` calls it a
  flagged leap of faith. The expected failure mode is a silent no-op.
- **All six wireless paths (Wave 3 #4–9) — the band-token question.**
  `Advanced_Wireless_Content.asp`'s own JS posts band-role-token field names
  (`2g1_*`, `5g1_*`, `6g1_*`) read from `wlnband_list`, while these defs post
  canonical `wl{N}_*` keys. `get_wl_nband_list()` is closed Broadcom SDK code and
  is not in the tree, so the live value cannot be settled from source. Full
  reasoning at [wireless.ts:24-42](../../src/pages/defs/wireless.ts:24);
  `STATUS.md` §known-open says "confirm live before any wireless write is ever
  cleared". **Reading `wlnband_list` is a prerequisite for planning any wireless
  session, not a step inside one.**
- **`wireless-general` (Wave 3 #4) — the SDN placeholder.** On SDN-managed
  ASUSWRT 5.0, `wl0_ssid` holds a **32-hex placeholder**, not the broadcast SSID,
  which lives in the MAINFH `sdn_rl` record's `apg{idx}_ssid` (`STATUS.md`;
  `CHANGELOG.md`; `docs/CURRENT_STATE_AUDIT.md`). The project's own position is
  that editing `wl`-family keys is correct for *writes*, but display and edit
  semantics on SDN units need a supervised session. If the baseline `wl0_ssid`
  looks like 32 hex characters, the page is not showing the real SSID.
- **`wol` wake and `site-survey` rescan (Wave 4 #15, #16).** Both call
  `guardedWrite` with `null` as `verifyKeys`
  ([wol.tsx:57](../../src/pages/defs/wol.tsx:57);
  [site-survey.tsx:99](../../src/pages/defs/site-survey.tsx:99)), so the guard
  skips verification and reports `applied` from `result.ok` — the HTTP status of
  a response the I/O layer states is never authoritative
  ([write-guard.ts:128-132](../../src/lib/write-guard.ts:128)). **The
  `verifyNvram()` discipline cannot be applied to either path**, and both need
  out-of-band confirmation planned in advance.
- **The `' Refresh '` / `SystemCmd` branch (Wave 4 #15).** The httpd-side
  behaviour — whether the literal leading and trailing spaces are required,
  whether the branch is allow-listed, what it does with `SystemCmd`, whether
  output is retrievable — is documented **nowhere** in the corpus. The interface
  `br0` is hard-coded into the command
  ([wol.tsx:54](../../src/pages/defs/wol.tsx:54)), and per-row Wake buttons pass
  the stored MAC through without revalidation
  ([wol.tsx:135](../../src/pages/defs/wol.tsx:135)).
- **`site-survey` rescan disruption (Wave 4 #16).** No doc states whether a radio
  rescan disrupts associated clients, how long a scan takes, or the full
  semantics of `wlc_scan_state` beyond "`5` means complete".
  `docs/WRITE_PATH_CHARACTERIZATION.md` §4 excludes wireless actions partly for
  session-disconnection risk but never names `restart_wlcscan` either way.

### E. The one live-verified claim is narrower than the tier implies

`tweaks` is excluded from protocol work because
[tools-tweaks.ts:52](../../src/pages/defs/tools-tweaks.ts:52) declares
`write: 'live-verified'`. The underlying evidence in
`docs/WRITE_PATH_CHARACTERIZATION.md` is narrower than a page-level tier suggests,
and the gap matters for anyone treating `tweaks` as proof that the write layer
works:

- Four fields were exercised: `ct_tcp_timeout` (via **one** of eight decomposed
  TCP boxes), `ct_udp_timeout` (via **one** of two UDP boxes), `ct_max`, and
  `aae_disable_force`. The other eight positions in the joined strings were never
  written.
- **The three `ct_*` writes went through `POST /start_apply.htm`**, the
  whole-form path. **Only `aae_disable_force` was ever written through
  `applyapp.cgi`** — the endpoint every def in this project actually ships
  ([tools-tweaks.ts:132](../../src/pages/defs/tools-tweaks.ts:132) and all 45
  others use `endpoint: 'applyapp'`). `docs/CURRENT_STATE_AUDIT.md` nonetheless
  records the page as live-verified "via `applyapp`".
- Whether httpd reads the joined `ct_tcp_timeout` string or reconstructs it
  server-side from the decomposed field names was **explicitly left unresolved**
  in the characterization. This def submits the joined representation only
  (`joinTcp`/`joinUdp`, [tools-tweaks.ts:30-37](../../src/pages/defs/tools-tweaks.ts:30)),
  which is the untested half of that question for the `applyapp` endpoint.
- The characterization's own scope statement is *"This does not generalize on its
  own. One field, one page, one session."*

So the accurate reading is: **one nvram key has been proven to apply as a delta
through `applyapp.cgi`.** The project's policy of using that endpoint for all 49
paths rests on a reading of httpd's `validate_apply()` asserted in `STATUS.md`
and in no other document. Every Wave 4 protocol is incidentally a test of it.
