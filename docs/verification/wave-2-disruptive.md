# Wave 2 — Disruptive write paths

**5 protocols.** The `firmware-reboot-reset` and `excluded-restart` tagged paths
that actually carry a `write` block: `switch-ctrl`, `lan-ip`, `static-route`,
`iptv`, `ipv6`.

This is preparation material. It does not authorise, schedule, or recommend any
session. Deciding whether a session happens, and running it, is the operator's.

---

## What makes this wave different

These five tags are **not** in `HARD_EXCLUDED_WRITE_CATEGORIES`
([write-policy.ts:46](../../src/lib/write-policy.ts:46)) — the hard block covers
only `wireless`, `wan`, `dhcp`, `vpn`, `firewall`. `firmware-reboot-reset` and
`excluded-restart` remain diagnostic tags governed by the ordinary read-only
interlock ([write-policy.ts:21-23](../../src/lib/write-policy.ts:21)). So unlike
Waves 1 and 3, these paths *are* reachable once read-only mode is off.

That makes the disruption profile the operating constraint rather than the code:
every path in this wave restarts the network stack or reboots the router, and
**every one of them defeats the built-in verifier** for the reason below.

---

## Mechanics that apply to every protocol in this file

- **Transport.** All five are `endpoint: 'applyapp'` →
  `POST /applyapp.cgi`, body `action_mode=apply&rc_service=<script>&<key>=<value>`
  ([router-io.ts:195-206](../../src/lib/router-io.ts:195)).
- **The verifier now waits out a per-path window before giving up, and
  `actionWait` sets it — it is not inert.** `guardedWrite()` resolves the
  confirmation window via `confirmWindow()` from each def's `actionWait` and
  `writeExclusion` category, rather than using `verifyNvram()`'s own bare
  10 000 ms / 800 ms defaults
  ([router-io.ts:321-322](../../src/lib/router-io.ts:321);
  [write-guard.ts:135](../../src/lib/write-guard.ts:135);
  [write-policy.ts:161-179](../../src/lib/write-policy.ts:161)). This is the
  most disruptive wave in the project, so it has the widest resolved ceilings:
  `firmware-reboot-reset` (`switch-ctrl`) is settle 120 s / ceiling 240 s;
  `excluded-restart` (`lan-ip`, `static-route`, `iptv`, `ipv6`) floors at a
  90 s ceiling regardless of the def's own `actionWait`
  ([write-policy.ts:131-140](../../src/lib/write-policy.ts:131)). The extension
  now waits that window out automatically — the operator no longer needs to
  manually delay a re-check to give a restart time to land. It is still true
  that `actionWait` is never sent on the wire on this endpoint —
  `buildWriteRequest()` puts `action_wait` on the wire only on the
  `start_apply` branch ([router-io.ts:231](../../src/lib/router-io.ts:231)) —
  but it now directly drives the built-in verifier's own timing, not just an
  operator's manual timer.
- **A window that closes with no matching read still means *unknown*, not
  *failed*.** Read failures inside the window (the router being briefly
  unreachable mid-restart) are recorded but do not end the loop; the loop
  stops early only on a lost session, reported as such
  ([router-io.ts:360-365](../../src/lib/router-io.ts:360)). If the ceiling is
  reached with no match, expect `SENT (unconfirmed)` and confirm with a manual
  forced-fresh re-read once the router is reachable again — a real possibility
  even with the wider ceiling, since some restarts here (`reboot` in
  particular) can still outlast it.
- **Rule lists:** `<` record, `>` field, leading `<` on a non-empty list
  ([rulelist.ts:1-10, :31-32](../../src/lib/rulelist.ts:1)).
- **ascii keys are stored decoded** — `decodeURIComponent` on read
  ([router-io.ts:119-134](../../src/lib/router-io.ts:119)), no re-encoding on
  write. Capture baselines in decoded form.
- **No product-side snapshot or undo.** Write baselines down outside the
  extension, and on this wave in particular, write down how to reach the router
  if the write goes wrong (physical port, current and prospective LAN address,
  reset procedure).

---

## 1. `switch-ctrl`

- **File:** [lan.ts:335](../../src/pages/defs/lan.ts:335) · write block
  [lan.ts:362](../../src/pages/defs/lan.ts:362)
- **Tag:** `firmware-reboot-reset`

**Baseline capture.** `nvram_get`: `jumbo_frame_enable`, `lan_stp`. Two keys,
both plain `'1'`/`'0'`. That is the entire page state — this is the smallest
baseline in the project.

**Smallest test.** `jumbo_frame_enable`. Both fields are equally simple to
encode, so the choice is about consequence: `lan_stp` changes layer-2 loop
handling across the whole bridge and interacts with anything else on the LAN that
speaks STP, while jumbo frames only widen the accepted frame size on the switch
ports. A wrong jumbo-frame value degrades throughput for oversized frames; a
wrong STP value can black-hole a segment.

**Expected confirmation.** After the router has rebooted and is reachable,
forced-fresh `nvram_get(jumbo_frame_enable)` returns the new value. The
in-extension verifier now waits out a resolved 120 s settle / 240 s ceiling
window before giving up (`confirmWindow()`,
[write-policy.ts:131-140](../../src/lib/write-policy.ts:131)) — reachable, in
principle, if the reboot completes inside that budget. In practice, expect
confirmation to fail anyway: see the session-loss gotcha below. Re-read
`lan_stp` too and confirm it is unchanged — the delta write should not have
touched it, and this is your check that the delta really was a delta.

**Known gotchas.**
- **This write reboots the router.** `rcService: 'reboot'`
  ([lan.ts:364](../../src/pages/defs/lan.ts:364)). The native page applies these
  the same way — this is not an artefact of the extension (def intro,
  [lan.ts:343-344](../../src/pages/defs/lan.ts:343)).
- NAT-acceleration / CTF / runner controls are **not exposed** on this page — HND
  platform, matching the native page which disables them (def intro). Any
  inherited note about writing `ctf_*` or runner keys here has no corresponding
  field; those names appear nowhere in the source or docs.
- `lan_stp` is listed in `docs/STOCK_VS_MERLIN_DIFF.md` among keys referenced in
  Merlin's `www/` and not stock's — i.e. it is a Merlin-side control.
- Read confidence is `live-verified`, so the baseline read is trustworthy;
  write confidence is `unverified-write`.
- **The Apply button now blocks for up to ~4 minutes.** Because `confirmWindow()`
  resolves this path's ceiling to 240 s and `SettingsPage`'s Apply handler
  `await`s `guardedWrite()` end-to-end (button stays disabled, labelled
  "Applying…", [SettingsPage.tsx:162-193](../../src/ui/SettingsPage.tsx:162)),
  the UI can sit on Apply for close to four minutes on this path — a real
  change from the previous behavior, where the request effectively resolved in
  the neighborhood of ~10 seconds regardless of the actual reboot. Do not
  assume the extension has hung.
- **Confirmation may still often fail even with the wider ceiling.** A reboot
  restarts httpd itself; if that invalidates the extension's session partway
  through the confirmation window, `verifyNvram()` detects the resulting
  redirect-to-login as `RouterAuthError` and stops immediately, reporting a
  lost-session error rather than a false confirm
  ([router-io.ts:360-365](../../src/lib/router-io.ts:360)). That is the
  correct, honest behavior — but it means the operator should not expect
  `switch-ctrl` to reliably report `verified: true` just because the ceiling is
  now reachable. Plan on the manual re-read regardless.

**Disruption / wait.** **Full reboot.** The def records `actionWait: 120`,
which is now both the native page's own 120-second wait *and* the settle delay
the built-in verifier applies before its first confirmation read, out to a
240 s ceiling (see above). Plan for the router to be unreachable for the
duration and for every client to lose its connection. Do not begin a manual
re-check before the router answers again — and be ready for the in-extension
result to be a lost-session error rather than a clean confirm either way.

**Rollback.** Re-write `jumbo_frame_enable` to the baseline value — which costs a
**second reboot**. There is no way to roll this page back without rebooting
again. Budget for two reboots before starting, not one.

---

## 2. `lan-ip`

- **File:** [lan.ts:25](../../src/pages/defs/lan.ts:25) · write block
  [lan.ts:68](../../src/pages/defs/lan.ts:68)
- **Tag:** `excluded-restart`

**Baseline capture.** `nvram_get`: `lan_ipaddr`, `lan_netmask`, `lan_hostname`,
`lan_domain`. Record `lan_ipaddr` prominently — it is the address you are
currently connected to.

**Smallest test.** `lan_domain` (the router's domain name, free text, max 32).
It is the only field on this page whose value does not participate in IP
addressing at all. `lan_ipaddr` and `lan_netmask` move the admin UI out from
under the very session performing the test; `lan_hostname` affects name
resolution for the router itself and is validated against a hostname pattern
that will reject values the domain field accepts. `lan_domain` changes the DNS
search suffix handed to clients and nothing else in the write path.

**Expected confirmation.** After `restart_net_and_phy` completes and the router
is reachable, forced-fresh `nvram_get(lan_domain)` returns the new value.
`lan_ipaddr` and `lan_netmask` must be byte-identical to baseline.

**Known gotchas.**
- `restart_net_and_phy` is named explicitly in the project's own
  restart-script exclusion list (`docs/WRITE_PATH_CHARACTERIZATION.md` §4) — it
  is why this page carries `excluded-restart` rather than a null tag.
- `lan_domain` is **also read by the `dhcp` page**
  ([lan.ts:88](../../src/pages/defs/lan.ts:88)). Changing it here changes what
  the DHCP view shows and what a subsequent DHCP write would resubmit. The two
  pages share the key with no coordination.
- `docs/STOCK_VS_MERLIN_DIFF.md` flags `lan_ipaddr_t` as stock-only naming —
  "check before use". This def uses `lan_ipaddr`, not `lan_ipaddr_t`; the
  distinction matters if you are cross-referencing older notes.
- The section note in the def warns that changing the LAN address moves the admin
  UI ([lan.ts:39](../../src/pages/defs/lan.ts:39)) — that warning is correct and
  is why it is not the test field.

**Disruption / wait.** **Network restart.** `restart_net_and_phy` reinitialises
the network stack and PHY layer: link goes down and back up on every port,
clients re-DHCP, and the admin session is interrupted. The def's own
`actionWait: 35` is now the built-in verifier's settle delay, widened to a 90 s
ceiling by the `excluded-restart` category floor
([write-policy.ts:131-140](../../src/lib/write-policy.ts:131)) — the extension
waits that window out on its own rather than the operator needing to delay a
manual re-check. Reconnecting to the router's new-old address is still on you
if the write ever changes `lan_ipaddr` itself (it shouldn't, on the recommended
smallest test).

**Rollback.** Re-write `lan_domain` to the baseline string — which costs a
**second `restart_net_and_phy`**. If a wrong `lan_ipaddr` was ever written, the
router is at the new address, not the old one: recovery is via the new address,
or a physical reset. Know that path before starting.

---

## 3. `static-route`

- **File:** [lan.ts:183](../../src/pages/defs/lan.ts:183) · write block
  [lan.ts:229](../../src/pages/defs/lan.ts:229)
- **Tag:** `excluded-restart`

**Baseline capture.** `nvram_get`: `sr_enable_x`. `nvram_char_to_ascii`:
`sr_rulelist`. Record the decoded rule list including its leading `<`, and count
the records.

**Smallest test.** `sr_enable_x` toggled `0` → `1`, **provided `sr_rulelist` is
empty at baseline**. With no routes in the list, enabling static routing installs
nothing — the flag is exercised in complete isolation from the routing table.
This is the only field on the page that is not the list itself. If `sr_rulelist`
is non-empty at baseline, flipping the enable flag activates every stored route
at once; in that case the smaller change is to append a single route to an
unreachable RFC 5737 test network (e.g. `192.0.2.0/255.255.255.0` via the
existing gateway, metric 15, interface `LAN`) while leaving `sr_enable_x` alone.

**Expected confirmation.** After `restart_net`, forced-fresh
`nvram_get(sr_enable_x)` returns `1`; `sr_rulelist` byte-identical to baseline.

**Known gotchas.**
- `sr_rulelist` is edited **directly** — no view key, no `buildFields` override —
  so the verifier compares the serialized list verbatim against what the editor
  produced. Any firmware-side normalisation reads as a failure.
- Column order is `ipaddr > netmask > gateway > matric > if`
  ([lan.ts:207-222](../../src/pages/defs/lan.ts:207)). Note the column id is
  literally `matric`, not `metric` — that is the stored field name, not a typo to
  fix. Metric range 1–15; interface is `LAN` / `WAN` / `MAN`.
- `maxRows: 64` ([lan.ts:206](../../src/pages/defs/lan.ts:206)). **No doc states a
  row cap for this key**; the 64 comes from the def alone.
- Read confidence `live-verified`.

**Disruption / wait.** **Network restart** (`restart_net`, def `actionWait: 10`).
Lighter than `restart_net_and_phy` — the PHY layer is not reinitialised — but
routing is reprogrammed and existing sessions across affected routes will break.
The `excluded-restart` category floors the built-in verifier's ceiling at 90 s
regardless of the def's own 10 s `actionWait`
([write-policy.ts:131-140](../../src/lib/write-policy.ts:131)), so the
extension now waits out a 10 s settle / 90 s ceiling window automatically
rather than giving up at 10 s.

**Rollback.** Re-write `sr_enable_x` to baseline (or write the recorded baseline
`sr_rulelist` back in full if the list was the thing that changed). Either way,
a second `restart_net`.

---

## 4. `iptv`

- **File:** [lan.ts:238](../../src/pages/defs/lan.ts:238) · write block
  [lan.ts:326](../../src/pages/defs/lan.ts:326)
- **Tag:** `excluded-restart`

**Baseline capture.** `nvram_get`: `switch_wantag`, `switch_stb_x`,
`mr_enable_x`, `mr_igmp_ver`, `mr_qleave_x`, `emf_enable`, `udpxy_enable_x`,
`ttl_inc_enable`. Eight plain keys, no lists, nothing ascii. **Record
`switch_wantag` and `switch_stb_x` with particular care** — together they define
the VLAN/port mapping.

**Smallest test.** `ttl_inc_enable`. It is a plain toggle that only increments
the TTL of forwarded packets; it changes no VLAN mapping, no port assignment, and
no multicast topology. Compare with the alternatives: `switch_wantag`
reconfigures VLAN port mapping outright (def intro,
[lan.ts:246-247](../../src/pages/defs/lan.ts:246)), `switch_stb_x` reassigns
physical LAN ports to the STB VLAN, `mr_enable_x` gates three dependent fields
via `showIf`, and `emf_enable` changes multicast forwarding behaviour for the
whole bridge. `ttl_inc_enable` has no dependents and no dependents on it.

**Expected confirmation.** After `restart_net`, forced-fresh
`nvram_get(ttl_inc_enable)` returns the new value. Re-read `switch_wantag` and
`switch_stb_x` and confirm both are unchanged — on a page that can remap physical
ports, confirming what *didn't* move is the more important check.

**Known gotchas.**
- `switch_wantag` is modelled with only the two generic options `none` and
  `manual`; **carrier-specific profiles retain their stored value if already
  set** (def intro) but cannot be selected here. If the baseline `switch_wantag`
  is a carrier profile string, it is not in the option list, and what the
  renderer does with an out-of-list select value is not something to discover
  during a live write session. Check the baseline value against the option list
  before touching this page at all.
- `switch_stb_x` renders only when `switch_wantag === 'none'`
  ([lan.ts:286](../../src/pages/defs/lan.ts:286)).
- `mr_igmp_ver` and `mr_qleave_x` render only when `mr_enable_x === '1'`
  ([lan.ts:311, :313](../../src/pages/defs/lan.ts:311)).
- **No key literally named `iptv_*` exists** on this page or in any doc — the
  page id is `iptv`, the keys are `switch_*` / `mr_*` / `emf_*` / `udpxy_*` /
  `ttl_*`. Any inherited note referring to `iptv_*` keys does not match.
- Read confidence `live-verified`.

**Disruption / wait.** **Network restart** (`restart_net`, def `actionWait: 10`).
If the write had touched VLAN mapping the disruption would be far larger; with
`ttl_inc_enable` it is a plain network-stack restart. The `excluded-restart`
category gives this path the same resolved 10 s settle / 90 s ceiling window as
`static-route`, waited out automatically by the built-in verifier
([write-policy.ts:131-140](../../src/lib/write-policy.ts:131)).

**Rollback.** Re-write `ttl_inc_enable` to baseline; second `restart_net`.

---

## 5. `ipv6`

- **File:** [ipv6.ts:56](../../src/pages/defs/ipv6.ts:56) · write block
  [ipv6.ts:391](../../src/pages/defs/ipv6.ts:391)
- **Tag:** `excluded-restart`

**Baseline capture.** All 30 keys in the read block
([ipv6.ts:65-99](../../src/pages/defs/ipv6.ts:65)) — `ipv6_service`, `ipv6_only`,
`ipv6_ifdev`, `ipv6_dhcp_pd`, `ipv6_accept_defrtr`, `ipv6_dhcp6c_release`, the
6in4/6rd tunnel parameters, `ipv6_ipaddr`, `ipv6_prefix*`, `ipv6_gateway`,
`ipv6_rtr_addr`, the DHCPv6 pool and lifetime keys, `ipv6_dnsenable`,
`ipv6_dns1`–`ipv6_dns3`, and `ipv6_radvd`. All plain `nvram_get`; nothing ascii,
no lists. **Record `ipv6_service` first** — it gates which of the other 29 fields
render at all.

**Smallest test — conditional on the baseline `ipv6_service` value.** Almost
every field on this page is `showIf`-gated on the connection type, so the right
answer depends on what the router is actually running:

| Baseline `ipv6_service` | Smallest test field | Why |
| --- | --- | --- |
| `dhcp6`, `ipv6pt`, or `flets` | `ipv6_dhcp6c_release` | Plain toggle; only affects whether the DHCPv6 client sends a RELEASE on WAN disconnect. Renders for exactly these three service types ([ipv6.ts:161](../../src/pages/defs/ipv6.ts:161)). No dependents. |
| `other`, `6to4`, `6in4`, `6rd` | `ipv6_dns3` | The third of three optional manual resolvers, rendered whenever DNS is manual (`isDnsManual`, [ipv6.ts:49-51](../../src/pages/defs/ipv6.ts:49)). Setting a third resolver that is never reached in practice is the least consequential change available. |
| `disabled` | **none** | With IPv6 off, `ipv6_service` is the only rendered field, and changing it turns IPv6 on. There is no zero-impact test. See the README flag list. |

**Expected confirmation.** After `restart_net`, forced-fresh `nvram_get` of the
chosen key returns the new value. Re-read `ipv6_service` and confirm it is
unchanged — that is the field whose accidental modification would change the
meaning of every other key on the page.

**Known gotchas.**
- **Everything here is `showIf`-gated on `ipv6_service`.** Five distinct
  predicates govern the page (`isLanManual`, `isLanManualOr6in4`,
  `isDhcpPoolShown`, `isDnsManual`, `isRaShown`,
  [ipv6.ts:45-51](../../src/pages/defs/ipv6.ts:45)). A field that is not rendered
  is not in `allFields` and therefore not in the delta — but its nvram value is
  still live. Changing `ipv6_service` changes which stale values become active.
- This page **restores several detail rows the native page permanently hides**
  (`display:none`, no un-hide path) — `docs/CURRENT_STATE_AUDIT.md` §ipv6. Those
  fields are editable here and are not editable on the router's own UI, so there
  is no native fallback for rolling them back through the web interface.
- `v6option_support` reads **`0`** on the operator's RT-BE92U
  (`docs/LIVE_PROBE_RT-BE92U.md` §2) — a capability that is present on RT-AX88U
  only because Merlin added it. Do not assume RT-AX88U notes transfer.
- Read confidence is **`structural`** ([ipv6.ts:62](../../src/pages/defs/ipv6.ts:62))
  — this page has never been live-read. The baseline capture is itself the first
  unproven step, and it is 30 keys wide. Capture and sanity-check the baseline in
  a separate, earlier session before any write session.
- Gated on `rcSupport.has('ipv6')` ([ipv6.ts:61](../../src/pages/defs/ipv6.ts:61)).
- The IPv6 *firewall* is a separate view over a different page — see Wave 1
  protocol 13. Nothing here touches `ipv6_fw_*`.

**Disruption / wait.** **Network restart** (`restart_net`, def `actionWait: 30`).
IPv6 addressing and RA are reprogrammed; IPv6 sessions drop, IPv4 generally
survives. The 30-second figure is now the built-in verifier's own settle delay
too, widened to a 90 s ceiling by the `excluded-restart` category floor
([write-policy.ts:131-140](../../src/lib/write-policy.ts:131)) — the extension
waits that window out automatically rather than always reporting
`SENT (unconfirmed)`.

**Rollback.** Re-write the single changed key to its baseline value; second
`restart_net`. If `ipv6_service` was changed, roll that back **first and alone**,
before touching anything else, because it determines which other fields are live.
