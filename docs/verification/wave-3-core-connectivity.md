# Wave 3 — Core connectivity write paths

**9 protocols.** All `dhcp`-tagged (1), `wan`-tagged (2), and `wireless`-tagged
(6) paths.

This is preparation material. It does not authorise, schedule, or recommend any
session. Deciding whether a session happens, and running it, is the operator's.

---

## Precondition specific to this wave

`dhcp`, `wan` and `wireless` are all in `HARD_EXCLUDED_WRITE_CATEGORIES`
([write-policy.ts:46](../../src/lib/write-policy.ts:46)). `guardedWrite()` refuses
them unconditionally, ahead of and independently of the read-only interlock
([write-guard.ts:110-116](../../src/lib/write-guard.ts:110)). Every protocol below
describes a session that cannot be executed as the code currently stands.
Nothing here proposes changing that.

**A second precondition is physical.** Every wireless path restarts the radios
and every WAN path restarts the uplink or reboots. A session on this wave should
not be run over the interface it is about to restart. Wired LAN access to the
router is a prerequisite for the six wireless protocols.

---

## Mechanics that apply to every protocol in this file

- **Transport.** All nine are `endpoint: 'applyapp'` → `POST /applyapp.cgi`,
  body `action_mode=apply&rc_service=<script>&<key>=<value>`
  ([router-io.ts:195-206](../../src/lib/router-io.ts:195)).
- **Confirmation scales per category, and `actionWait` is not inert.**
  `guardedWrite()` resolves the confirmation window via `confirmWindow()` from
  each def's `actionWait` and `writeExclusion` category, rather than using
  `verifyNvram()`'s own bare 10 000 ms / 800 ms defaults
  ([router-io.ts:321-322](../../src/lib/router-io.ts:321);
  [write-guard.ts:135](../../src/lib/write-guard.ts:135);
  [write-policy.ts:161-179](../../src/lib/write-policy.ts:161)). `dhcp` floors
  at a 90 s ceiling, `wan` at 120 s (`dual-wan`'s own 70 s `actionWait` widens
  it further, to 140 s), and `wireless` at 45 s
  ([write-policy.ts:131-140](../../src/lib/write-policy.ts:131)). The per-def
  `actionWait` values (3, 5, 8, 10, 30, 70) are no longer just an operator's
  timer — they set the settle delay before the verifier's first read and, when
  large enough, widen the ceiling itself. It is still true that `actionWait`
  is never sent on the wire on this endpoint — only `start_apply` puts it in
  the form body ([router-io.ts:231](../../src/lib/router-io.ts:231)). Read
  failures inside the window are recorded but do not end the loop; only a lost
  session stops it early, reported as such
  ([router-io.ts:360-365](../../src/lib/router-io.ts:360)). If a restart still
  outlasts its resolved ceiling — plausible for `reboot`-adjacent or
  slow-to-reassociate paths — `SENT (unconfirmed)` still means *unknown*, not
  *failed*; re-read by hand.
- **Rule lists:** `<` record, `>` field, leading `<` on a non-empty list
  ([rulelist.ts:1-10, :31-32](../../src/lib/rulelist.ts:1)).
- **ascii keys are stored decoded** ([router-io.ts:119-134](../../src/lib/router-io.ts:119));
  no re-encoding on write. Capture baselines in decoded form.
- **`{p}` instance expansion** happens at the I/O boundary
  ([SettingsPage.tsx:170-186](../../src/ui/SettingsPage.tsx:170)) and applies to
  keys *and* to `rcService`. Baseline the expanded keys for the unit or band you
  are editing.
- **No product-side snapshot or undo.** Baselines go on paper.

---

## The band-token question (applies to all six wireless protocols)

This is the single largest unresolved item in this wave, and it is documented in
the source rather than inferred:

`Advanced_Wireless_Content.asp`'s own JS keys every band by a **band-role token**
read from nvram `wlnband_list` — `2g1` / `5g1` / `6g1` — and posts fields as
`${token}_ssid`, `${token}_auth_mode_x`, and so on. Taken alone that would make
the real nvram prefix for this generation the band token, not the classic
`wl0_` / `wl1_` / `wl2_` unit index. Against that: this project's static nvram
inventory lists `wl0_ssid` / `wl1_ssid` / `wl2_ssid` and contains **zero**
`2g1`/`5g1`/`6g1`-prefixed keys anywhere, and the operator's own brief states
`wl0=2.4G, wl1=5G, wl2=6G`. `get_wl_nband_list()` — which populates
`wlnband_list` at runtime — is closed Broadcom SDK code and is not in the tree,
so the live value on this unit cannot be settled from source.
(Full reasoning: [wireless.ts:24-42](../../src/pages/defs/wireless.ts:24); also
`STATUS.md` §known-open.)

**Practical consequence for every wireless protocol below:** the first thing any
wireless session should do — before any write — is read `wlnband_list` and record
its actual value. If it returns band-role tokens, every `wl{p}_*` write in this
wave is addressing a key family the page's own JS does not use, and the expected
failure mode is a *silent no-op*: the write is accepted, nvram is unchanged, and
`verifyNvram` reports `verified: false` with `actual` equal to the baseline. That
outcome is a finding about the key family, not a bug in the write path.

---

# DHCP-tagged (1)

## 1. `dhcp`

- **File:** [lan.ts:77](../../src/pages/defs/lan.ts:77) · write block
  [lan.ts:174](../../src/pages/defs/lan.ts:174)
- **Tag:** `dhcp`

**Baseline capture.** `nvram_get`: `dhcp_enable_x`, `lan_domain`, `dhcp_start`,
`dhcp_end`, `dhcp_lease`, `dhcp_gateway_x`, `dhcp_dns1_x`, `dhcp_dns2_x`,
`dhcpd_dns_router`, `dhcp_wins_x`, `dhcp_static_x`, `dhcpd_querylog`.
`nvram_char_to_ascii`: `dhcp_staticlist`. Record the static-lease list decoded
and count its records — it is the one key here whose corruption is not
self-evident.

**Smallest test.** `dhcpd_querylog` (log DHCP queries, Merlin addition,
[lan.ts:150-155](../../src/pages/defs/lan.ts:150)). It is a plain toggle that
changes only syslog verbosity: no lease, no pool boundary, no resolver, no
gateway. Every other field on the page either defines the address pool
(`dhcp_start`/`dhcp_end`/`dhcp_lease`), hands out configuration to clients
(`dhcp_dns*`, `dhcp_gateway_x`, `dhcp_wins_x`, `lan_domain`), or gates the server
itself (`dhcp_enable_x`, `dhcp_static_x`). It has the additional merit of giving
you a **second independent confirmation signal**: after the write, DHCP queries
should start (or stop) appearing in the system log.

**Expected confirmation.** Forced-fresh `nvram_get(dhcpd_querylog)` returns the
new value. `dhcp_staticlist` byte-identical to baseline. The `dhcp` category's
resolved window is a 30 s settle / 90 s ceiling (the def's own `actionWait: 30`
widened by the category floor, [write-policy.ts:131-140](../../src/lib/write-policy.ts:131)),
which the built-in verifier now waits out automatically rather than giving up
at a fixed 10 s. That doesn't change what this protocol is today, though:
`dhcp` remains hard-blocked (see the precondition above), so no write on this
path — confirmed or not — can be submitted until the category is cleared.

**Known gotchas.**
- **`restart_net_and_phy`, not `restart_dhcpd`.** The def's `rcService` is
  `restart_net_and_phy` ([lan.ts:176](../../src/pages/defs/lan.ts:176)). Applying
  a DHCP change reinitialises the whole network stack and PHY layer. Any
  inherited note expecting `restart_dhcpd` on this page is wrong for this
  firmware — `restart_dhcpd` appears in the project only as a name in the
  restart-script exclusion policy, never as a script this code sends.
- **`lan_domain` is shared with the `lan-ip` page**
  ([lan.ts:34](../../src/pages/defs/lan.ts:34) and
  [lan.ts:88](../../src/pages/defs/lan.ts:88)). The two views read and write the
  same key with no coordination; a change on either shows up on both.
- `dhcp_staticlist` column order is `mac > ip > dns > hostname`
  ([lan.ts:163-168](../../src/pages/defs/lan.ts:163)); `maxRows: 128`, a figure
  that comes from the def alone — **no doc states a cap for this key.**
- `dhcpd_dns_router` renders only when at least one of `dhcp_dns1_x` /
  `dhcp_dns2_x` is non-empty ([lan.ts:139](../../src/pages/defs/lan.ts:139)).
- Read confidence `live-verified`; the DHCP renderer and rule-list editor are
  among the few views exercised in the live Chrome pass (`STATUS.md`).

**Disruption / wait.** **Network restart.** `restart_net_and_phy` drops link on
every port; clients re-DHCP; the admin session is interrupted. The def carries
`actionWait: 30`. Allow 45–60 seconds and expect to reconnect.

**Rollback.** Re-write `dhcpd_querylog` to baseline — a second
`restart_net_and_phy`. Budget two network restarts.

---

# WAN-tagged (2)

## 2. `wan`

- **File:** [wan.ts:72](../../src/pages/defs/wan.ts:72) · write block
  [wan.ts:233](../../src/pages/defs/wan.ts:233)
- **Tag:** `wan` · **instance page** (`{p}` = WAN unit, `0` or `1`)

**Baseline capture.** For unit *N*: `nvram_get` of `wanN_`{`proto`, `enable`,
`dhcpenable_x`, `ipaddr_x`, `netmask_x`, `gateway_x`, `dnsenable_x`, `dns1_x`,
`dns2_x`, `pppoe_mtu`, `nat_x`, `upnp_enable`, `hostname`, `hwaddr_x`, `mtu`,
`dhcp_qry`}; `nvram_char_to_ascii` of `wanN_pppoe_username` and
`wanN_pppoe_passwd`. The PPPoE credentials are secrets — record them as such, and
note that they are the ISP's, not recoverable from the router if lost.

**Smallest test.** `wanN_hostname` (the router's host name as presented to the
ISP, free text, max 32). Rationale: it is the only field on the page that is
neither part of the IP configuration, nor a credential, nor a NAT/UPnP gate. Some
ISPs bind service to it (def section note,
[wan.ts:219-220](../../src/pages/defs/wan.ts:219)), so it is not *zero*
consequence — but on a DHCP or static WAN it is advisory, whereas `wanN_proto`,
`wanN_dhcpenable_x`, `wanN_ipaddr_x` and the DNS fields all directly determine
whether the uplink comes back. `wanN_hwaddr_x` (MAC clone) is the other candidate
and is worse: on ISPs that bind to MAC, a wrong value costs a support call.

**Expected confirmation.** Forced-fresh `nvram_get(wanN_hostname)` returns the
new value once the WAN is back. Confirm `wanN_proto` and the IP fields are
byte-identical to baseline.

**Known gotchas.**
- **The documented unit-dispatch hazard.** `restart_wan_if` is *not* unit-suffixed
  in this def. httpd splices the target unit in at dispatch time from a posted
  `wan_unit` field, defaulting to `"0"` when absent — and **this project's delta
  write never posts a bare `wan_unit`**. A live Apply on the Secondary WAN
  instance would therefore restart WAN unit 0 rather than unit 1. This is
  recorded verbatim as a known limitation in the def header
  ([wan.ts:22-33](../../src/pages/defs/wan.ts:22)) and independently in
  `docs/CURRENT_STATE_AUDIT.md` §wan. **Do not run the first session of this
  protocol against unit 1.**
- `restart_wan_if` (what the code sends) vs `restart_wan` (what
  `docs/WRITE_PATH_CHARACTERIZATION.md` §4 names in its exclusion list) are
  different literals and no doc reconciles them. The code is authoritative for
  what is sent; the policy list is authoritative for why the page is excluded.
- IPv6 transition protocols (MAP-E, DS-Lite, V6 Plus, OCN, LW4o6) require
  `Softwire46_support` and are **not modelled**
  ([wan.ts:117](../../src/pages/defs/wan.ts:117)). If the baseline `wanN_proto`
  is one of those, it is not in the option list.
- Large parts of the form are `showIf`-gated on `wanN_proto` and
  `wanN_dhcpenable_x` — a field that is not rendered is not in the delta, but its
  stored value stays live.
- Read confidence `live-verified`; Secondary WAN is gated on `dualwan_support`.

**Disruption / wait.** **WAN restart.** The uplink drops and re-establishes; LAN
and wireless stay up, so the admin session survives if you are on the LAN side.
Def `actionWait: 5` (native page's optimistic figure). Allow 30–60 seconds for a
PPPoE re-establish.

**Rollback.** Re-write `wanN_hostname` to baseline; second `restart_wan_if`.
Because a hostname change can affect an ISP-side binding, verify the WAN actually
carries traffic after both the write and the rollback, not just that nvram reads
back correctly.

---

## 3. `dual-wan`

- **File:** [wan.ts:246](../../src/pages/defs/wan.ts:246) · write block
  [wan.ts:354](../../src/pages/defs/wan.ts:354)
- **Tag:** `wan`

**Baseline capture.** `nvram_get`: `wans_dualwan`, `wans_mode`, `wans_lb_ratio`,
`wans_usb_bk`, `wandog_enable`, `wandog_target`, `wandog_interval`,
`wandog_maxfail`, `wandog_fb_count`, `dns_probe`, `dns_probe_host`. All plain,
none ascii, no lists. **Record `wans_dualwan` exactly** — it is a
space-separated two-token string and the def only models three of the possible
combinations.

**Smallest test.** `wandog_interval` (ping-monitor retry interval, 2–99 seconds).
It is a plain integer that only changes how often the failover watchdog probes;
it cannot itself trigger or prevent a failover the way `wandog_maxfail` or
`wandog_enable` can, and it does not touch the interface assignment at all.
`wans_dualwan` and `wans_mode` reconfigure which physical interfaces are WANs —
the largest change on the page, not the smallest.

**Expected confirmation.** After the router has rebooted and is reachable,
forced-fresh `nvram_get(wandog_interval)` returns the new value. `wans_dualwan`
and `wans_mode` byte-identical to baseline.

**Known gotchas.**
- **This write reboots the router.** `rcService: 'reboot'`, `actionWait: 70`
  ([wan.ts:356-357](../../src/pages/defs/wan.ts:356)). This is the most
  disruptive apply in the wave, and it is triggered by *any* field on the page,
  including the watchdog interval.
- `wans_dualwan` is presented as a **small closed set** of practical two-token
  combinations rather than the native page's live `wans_cap` probe plus per-model
  LAN-port tables, which are impractical to replicate declaratively (def header,
  [wan.ts:35-39](../../src/pages/defs/wan.ts:35)). If the baseline value is not
  one of the three modelled options, it is not in the select list.
- `wans_mode` is also **read by three other pages** — `dmz`, `ddns`,
  `nat-passthrough` ([wan.ts:570, :632, :746](../../src/pages/defs/wan.ts:570)) —
  where it gates `showIf` conditions. Changing it here changes what those pages
  render.
- `wandog_fb_count` renders only when `wans_mode === 'fb'`; `wans_lb_ratio` only
  when mode is `lb`; `wans_usb_bk` only when `wans_dualwan` contains `usb`.
- `docs/STOCK_VS_MERLIN_DIFF.md` flags `wandog_delay` as stock-only naming
  ("check before use") — it is not among the keys this def uses.
- Read confidence **`structural`** ([wan.ts:252](../../src/pages/defs/wan.ts:252))
  — never live-read. Gated on `dualwan_support`.

**Disruption / wait.** **Full reboot,** ~70 seconds per the def's transcription
of the native page's wait. All clients drop. Do not begin re-checking until the
router answers.

**Rollback.** Re-write `wandog_interval` to baseline — a **second reboot**.
Budget two reboots before starting.

---

# Wireless-tagged (6)

> Read the band-token section above before any of the six. Where a protocol says
> "band *B*", substitute the `{p}` value you selected: `0` = 2.4 GHz, `1` = 5 GHz,
> `2` = 6 GHz (6 GHz gated on `band6g_support`,
> [wireless.ts:86](../../src/pages/defs/wireless.ts:86)).

## 4. `wireless-general`

- **File:** [wireless.ts:106](../../src/pages/defs/wireless.ts:106) · write block
  [wireless.ts:248](../../src/pages/defs/wireless.ts:248)
- **Tag:** `wireless` · **instance page** (`{p}` = band)

**Baseline capture.** Global `smart_connect_x`, plus for band *B*: `nvram_get` of
`wlB_`{`closed`, `auth_mode_x`, `crypto`, `mfp`, `wpa_gtk_rekey`, `bw`,
`chanspec`} and `nvram_char_to_ascii` of `wlB_ssid` and `wlB_wpa_psk`. **Capture
all three bands' SSIDs and PSKs, not just the one you intend to edit** — Smart
Connect couples them, and you need to be able to prove the other two did not
move. `wlB_wpa_psk` is the network's passphrase: treat it as a secret and confirm
byte-identity afterwards.

**Smallest test.** `wlB_wpa_gtk_rekey` (group key rotation interval, seconds,
0–2592000). It is a plain integer that changes only how often the group key
rotates; associated clients rekey transparently and none are disconnected by the
value itself. Compare: `wlB_ssid` renames the network and drops every client;
`wlB_auth_mode_x` changes the security suite and gates four other fields via
`showIf`; `wlB_wpa_psk` changes the passphrase and locks out every client;
`wlB_chanspec` and `wlB_bw` move the radio. `wpa_gtk_rekey` is the only field
here whose worst case is "keys rotate at a different cadence".

Note it is `showIf`-gated on the auth method being in `AUTH_SHOWS_ENCRYPTION`
([wireless.ts:215](../../src/pages/defs/wireless.ts:215)) — on an open or
OWE-only band it will not render, and there is then no small test on that band.

**Expected confirmation.** Forced-fresh `nvram_get(wlB_wpa_gtk_rekey)` returns
the new value. **Then re-read `wl0_ssid`, `wl1_ssid`, `wl2_ssid`, all three
PSKs, and `smart_connect_x`** and confirm byte-identity against baseline.

**Known gotchas.**
- **Band-token mismatch** — see the section above. This is the page the issue is
  documented against.
- **SDN placeholder.** On SDN-managed ASUSWRT 5.0, `wl0_ssid` holds a
  **32-hex placeholder**, not the broadcast SSID; the real SSID lives in the
  MAINFH `sdn_rl` record's `apg{idx}_ssid` (`STATUS.md` §known-open;
  `CHANGELOG.md`; `docs/CURRENT_STATE_AUDIT.md`). The project's own note is that
  editing `wl`-family keys is correct for writes per `validate_instance`, but
  display/edit semantics on SDN units need a supervised session. **If the
  baseline `wl0_ssid` looks like 32 hex characters, you are on an SDN unit and
  the page is not showing you the real SSID.** Check this before anything else.
- Switching bands **reloads the page's reads and discards unsaved edits**
  ([types.ts:180-181](../../src/pages/types.ts:180)).
- `wlB_chanspec` is a chanspec string (`36`, `36u`, `6g37/320-1`), not a channel
  number — BRCM platforms post `_chanspec`, never `_channel`/`_nctrlsb`
  ([wireless.ts:52-55](../../src/pages/defs/wireless.ts:52)).
- MLO and `wlB_nmode_x` are deliberately not modelled
  ([wireless.ts:43-59](../../src/pages/defs/wireless.ts:43)).
- Smart Connect's per-band opt-out (`smart_connect_selif_x`) is not modelled;
  enabling joins all eligible bands with 2.4 GHz as reference
  ([wireless.ts:133](../../src/pages/defs/wireless.ts:133)).
- Read confidence **`structural`**.

**Disruption / wait.** **All radios restart.** `restart_wireless`, def
`actionWait: 10`. Every wireless client on every band disassociates and
reassociates. Run this from a wired connection. Allow ~20 seconds.

**Rollback.** Re-write `wlB_wpa_gtk_rekey` to baseline; second
`restart_wireless`.

---

## 5. `wps`

- **File:** [wireless.ts:257](../../src/pages/defs/wireless.ts:257) · write block
  [wireless.ts:288](../../src/pages/defs/wireless.ts:288)
- **Tag:** `wireless`

**Baseline capture.** `nvram_get`: `wps_enable`, `wps_band_x`. Two keys, both
global. That is the whole page.

**Smallest test.** `wps_band_x` (which band WPS operates on), **provided
`wps_enable` is `0` at baseline**. With WPS disabled, the band selector is inert
and the write exercises a plain scalar with no pairing surface exposed. If
`wps_enable` is `1` at baseline, the smaller change is `wps_enable` → `0`
(disabling WPS reduces exposure; enabling it increases exposure), and that
direction should be preferred over changing the band while it is live.

**Expected confirmation.** Forced-fresh `nvram_get(wps_band_x)` returns the new
value; `wps_enable` byte-identical.

**Known gotchas.**
- **No instance selector here.** `wps_enable` and `wps_band_x` are single global
  keys — the band being configured is the field's *value*, not a `wl{p}_` prefix
  ([wireless.ts:263-265](../../src/pages/defs/wireless.ts:263)). So the band-token
  question does not apply to this page, and `wps_band_x` values are `0`/`1`, not
  `wl0`/`wl1`.
- **6 GHz is deliberately absent** from the option list: the native page removes
  it when `band6g_support` is set, because 6 GHz is SAE/WPA3-only and WPS needs
  an Open/PSK-compatible band
  ([wireless.ts:278](../../src/pages/defs/wireless.ts:278)). Writing `2` here
  would be inventing a value the native UI never emits.
- Read confidence **`structural`**.

**Disruption / wait.** `restart_wireless`, def `actionWait: 3`. All radios
restart despite this being a two-key page. Wired access required. Allow
~20 seconds.

**Rollback.** Re-write `wps_band_x` to baseline; second `restart_wireless`.

---

## 6. `wds`

- **File:** [wireless.ts:297](../../src/pages/defs/wireless.ts:297) · write block
  [wireless.ts:351](../../src/pages/defs/wireless.ts:351)
- **Tag:** `wireless` · **instance page** (`{p}` = band)

**Baseline capture.** For band *B*: `nvram_get` of `wlB_mode_x` and
`wlB_wdsapply_x`; `nvram_char_to_ascii` of `wlB_wdslist`. Record the WDS list
decoded, including the leading `<`.

**Smallest test.** `wlB_wdsapply_x` ("Connect to APs in list", yes/no),
**provided `wlB_mode_x` is not `0`** — the field is `showIf`-gated on the bridge
mode being something other than AP Only
([wireless.ts:328](../../src/pages/defs/wireless.ts:328)). It is a plain toggle
that changes only whether the listed peers are dialled, and with an **empty**
`wlB_wdslist` it has no operational effect at all. If `wlB_mode_x` is `0` at
baseline (AP Only — the normal case), the only rendered field is `wlB_mode_x`
itself, and changing it puts the radio into a bridging mode. **On a router in AP
Only mode this page has no small test**; see the README flag list.

**Expected confirmation.** Forced-fresh `nvram_get(wlB_wdsapply_x)` returns the
new value; `wlB_mode_x` and `wlB_wdslist` byte-identical.

**Known gotchas.**
- `wlB_wdslist` is a **single-column** list: the page's own join code is
  `tmp_value += "<" + mac` with **no `>` ever appended**, verified from source and
  recorded in the section note
  ([wireless.ts:334](../../src/pages/defs/wireless.ts:334)). So the serialized
  form is `<mac<mac<mac` — if you see `>` in the baseline, the encoding
  assumption is wrong and the session should stop.
- `maxRows: 4` ([wireless.ts:342](../../src/pages/defs/wireless.ts:342)).
- The key is **`wlB_wdsapply_x`, not `wlB_lazywds`.** `lazywds` appears in no
  source file and no doc in this project; any inherited note naming it does not
  match this def.
- `actionWait: 8` is derived from the native page's own `wl6_support ? 8 : 3`
  branch, with `wl6_support` confirmed present in this unit's live `rc_support`
  ([wireless.ts:353-355](../../src/pages/defs/wireless.ts:353)).
- Band-token question applies. Read confidence **`structural`**.

**Disruption / wait.** `restart_wireless`. If WDS is actually carrying a
backhaul, that link drops. Wired access required. Allow ~20 seconds.

**Rollback.** Re-write `wlB_wdsapply_x` to baseline; second `restart_wireless`.

---

## 7. `wireless-macfilter`

- **File:** [wireless.ts:363](../../src/pages/defs/wireless.ts:363) · write block
  [wireless.ts:407](../../src/pages/defs/wireless.ts:407)
- **Tag:** `wireless` · **instance page** (`{p}` = band)

**Baseline capture.** For band *B*: `nvram_get` of `wlB_macmode`;
`nvram_char_to_ascii` of `wlB_maclist_x`. Record the list decoded and count the
entries.

**Smallest test.** Append **one** MAC address that belongs to no device on the
network (e.g. a locally-administered address such as `02:00:00:00:00:01`) while
leaving `wlB_macmode` at baseline. Rationale: with `macmode` at `deny`, a
never-present MAC blocks nothing; with `macmode` at `allow`, appending an entry
only *widens* the whitelist and cannot lock anyone out; with `macmode` at
`disabled` the list is inert entirely. In all three baseline states, appending an
unused MAC is the smallest change with a defined, harmless outcome —
whereas changing `wlB_macmode` itself flips between whitelist and blacklist
semantics and can disconnect every client on the band at once.

Note the list field is `showIf`-gated on `wlB_macmode !== 'disabled'`
([wireless.ts:402](../../src/pages/defs/wireless.ts:402)) — if the filter is
disabled at baseline the list does not render, and the only rendered field is
`wlB_macmode`.

**Expected confirmation.** Forced-fresh `nvram_char_to_ascii(wlB_maclist_x)`
returns `<baseline-body><02:00:00:00:00:01`. The list is edited **directly** —
no view key, no `buildFields` override — so the verifier compares verbatim.

**Known gotchas.**
- Same **single-column, no-`>`** encoding as the WDS list, stated explicitly in
  the field hint ([wireless.ts:393](../../src/pages/defs/wireless.ts:393)).
- `maxRows: 64` ([wireless.ts:397](../../src/pages/defs/wireless.ts:397)) — this
  is the one wireless list cap that `docs/CURRENT_STATE_AUDIT.md` also states
  ("up to 64 entries"), so def and docs agree here. The `acl96` token in live
  `rc_support` is **not** a 96-entry claim; no doc connects it to this cap.
- `wlB_macmode` values are `disabled` / `allow` / `deny` — strings, not `0`/`1`.
  The native page's enable toggle maps "No" onto the literal `disabled`
  ([wireless.ts:382](../../src/pages/defs/wireless.ts:382)).
- Band-token question applies. Read confidence **`structural`**.

**Disruption / wait.** `restart_wireless`, def `actionWait: 3`. All radios
restart. Wired access required. Allow ~20 seconds.

**Rollback.** Write the recorded baseline `wlB_maclist_x` back in full.

---

## 8. `radius`

- **File:** [wireless.ts:416](../../src/pages/defs/wireless.ts:416) · write block
  [wireless.ts:455](../../src/pages/defs/wireless.ts:455)
- **Tag:** `wireless` · **instance page** (`{p}` = band)

**Baseline capture.** For band *B*: `nvram_get` of `wlB_radius_ipaddr`,
`wlB_radius_port`, `wlB_radius_key`. **All three are read as plain `nvram_get`,
including the shared secret** ([wireless.ts:428](../../src/pages/defs/wireless.ts:428))
— note that this differs from `wlB_wpa_psk` on the general page, which *is* read
as ascii. Record the key value as a secret.

**Smallest test.** `wlB_radius_port` (0–65535). It is a plain integer, and on a
band whose `auth_mode_x` does not require 802.1x, no RADIUS transaction is
happening at all, so the value is inert. Changing `wlB_radius_ipaddr` points
authentication at a different host; changing `wlB_radius_key` breaks the trust
relationship with the existing server. The port is the only one of the three
whose wrong value fails closed and visibly.

**Before running this test, check `wlB_auth_mode_x` on the general page.** If the
band is running an Enterprise auth method, a wrong RADIUS port stops clients
authenticating. If it is running a Personal/PSK method, the RADIUS fields are not
consulted.

**Expected confirmation.** Forced-fresh `nvram_get(wlB_radius_port)` returns the
new value; `wlB_radius_ipaddr` and `wlB_radius_key` byte-identical.

**Known gotchas.**
- **The native page's own band selector offers only 2.4 GHz and 5 GHz** — there
  is no 6 GHz option in its `<select>`, unlike every other page in this category.
  Band 2 is modelled here because `Advanced_Wireless_Content.asp` reads and writes
  the same `wl{p}_radius_*` keys for 6 GHz when its auth method requires 802.1x —
  but **that extension is unverified against this dedicated page's own native UI**
  (def intro, [wireless.ts:425-426](../../src/pages/defs/wireless.ts:425)). Prefer
  band 0 or 1 for a first session.
- All three fields are `required: true`; there is no "clear the RADIUS config"
  state expressible here.
- Band-token question applies. Read confidence **`structural`**.

**Disruption / wait.** `restart_wireless`, def `actionWait: 3`. All radios
restart; on an Enterprise-auth band, clients must re-authenticate. Wired access
required. Allow ~20 seconds.

**Rollback.** Re-write `wlB_radius_port` to baseline; second `restart_wireless`.

---

## 9. `wireless-professional`

- **File:** [wireless.ts:464](../../src/pages/defs/wireless.ts:464) · write block
  [wireless.ts:591](../../src/pages/defs/wireless.ts:591)
- **Tag:** `wireless` · **instance page** (`{p}` = band)

**Baseline capture.** For band *B*: `nvram_get` of the 13 keys at
[wireless.ts:479-493](../../src/pages/defs/wireless.ts:479) — `wlB_`{`radio`,
`ap_isolate`, `user_rssi`, `igs`, `bcn`, `dtim`, `frag`, `rts`, `txpower`,
`11be`, `ofdma`, `mumimo`, `atf`}. All plain, none ascii, no lists.

**Smallest test.** `wlB_dtim` (DTIM interval, 1–255). It is a plain integer
within a validated range, it changes only how often buffered multicast is
delivered relative to beacons, and no client disassociates because of it.
Compare: `wlB_radio` turns the band off entirely; `wlB_txpower` changes coverage;
`wlB_11be`, `wlB_ofdma` and `wlB_mumimo` change the PHY feature set and are
capability-gated; `wlB_ap_isolate` changes client-to-client reachability;
`wlB_user_rssi` actively disconnects clients below a threshold. `wlB_bcn`,
`wlB_frag` and `wlB_rts` are comparably safe integers — `dtim` is preferred
because its effect (power-save wake cadence) is the least likely to be
load-bearing on any given network.

**Expected confirmation.** Forced-fresh `nvram_get(wlB_dtim)` returns the new
value. No `buildFields`/`buildVerify` overrides on this page, so the changed key
is submitted and verified verbatim.

**Known gotchas.**
- **This page has the only `read: 'live-verified'` in the wireless category**
  ([wireless.ts:474](../../src/pages/defs/wireless.ts:474)) — the baseline read
  here is more trustworthy than on the other five.
- **It is also the only wireless page with an RT-BE92U model overlay.** The def
  is extracted from `sysdep/RT-BE92U/www/Advanced_WAdvanced_Content.asp`, not the
  generic `www/` root ([wireless.ts:5-10](../../src/pages/defs/wireless.ts:5)).
  Cross-generation notes are less transferable here than elsewhere.
- **Known benign console exception:** the native page throws one uncaught
  JavaScript exception per load from `require.min.js`'s `onScriptError`,
  reproducible, root cause not investigated
  (`docs/LIVE_PROBE_RT-BE92U.md` §7.3; def comment at
  [wireless.ts:471-473](../../src/pages/defs/wireless.ts:471)). Do not read that
  as evidence of a problem with the write.
- `actionWait: 10` is the native page's **model-specific override** — RT-BE92U is
  explicitly listed in `applyRule()`'s `based_modelid == "RT-BE92U"` branch
  ([wireless.ts:594-595](../../src/pages/defs/wireless.ts:594)).
- The WiFi 7 section is gated on `wifi7_support`; `wlB_txpower` on
  `power_support` ([wireless.ts:518, :586](../../src/pages/defs/wireless.ts:518)).
- `wlB_user_rssi` uses `maxLength: 3` rather than a numeric range; the native
  page's own range when enabled is −90 to −40 with `0` meaning disabled
  ([wireless.ts:509](../../src/pages/defs/wireless.ts:509)) — the def does not
  enforce that range.
- Band-token question applies.

**Disruption / wait.** `restart_wireless`, def `actionWait: 10` (model-specific).
All radios restart. Wired access required. Allow ~20 seconds.

**Rollback.** Re-write `wlB_dtim` to baseline; second `restart_wireless`.
