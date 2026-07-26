# Wave 1 — VPN and Firewall write paths

**18 protocols.** All `writeExclusion: 'vpn'` (7) and `writeExclusion: 'firewall'` (11) paths that carry a `write` block.

This is preparation material. It does not authorise, schedule, or recommend any
session. Deciding whether a session happens, and running it, is the operator's.

---

## Precondition specific to this wave

`vpn` and `firewall` are both in `HARD_EXCLUDED_WRITE_CATEGORIES`
([write-policy.ts:46](../../src/lib/write-policy.ts:46)). `guardedWrite()` refuses
them before the read-only check and independently of it
([write-guard.ts:110-116](../../src/lib/write-guard.ts:110)) — turning read-only
mode off does not reach these paths. Every protocol below therefore describes a
session that cannot be executed as the code currently stands. Nothing in this
file proposes changing that; the block is the operator's to clear or not.

---

## Mechanics that apply to every protocol in this file

Verified from source, not from the prose docs:

- **Transport.** Every path here is `endpoint: 'applyapp'`. The request is
  `POST /applyapp.cgi` with body `action_mode=apply&rc_service=<script>&<key>=<value>…`
  ([router-io.ts:195-206](../../src/lib/router-io.ts:195)).
- **Confirmation scales per category, and `actionWait` is not inert.**
  `guardedWrite()` resolves a per-path window via `confirmWindow()` from the
  def's `actionWait` and `writeExclusion` category
  ([write-guard.ts:135](../../src/lib/write-guard.ts:135);
  [write-policy.ts:161-179](../../src/lib/write-policy.ts:161)), rather than
  using `verifyNvram()`'s own bare 10 s default
  ([router-io.ts:321-322](../../src/lib/router-io.ts:321)). Both `vpn` and
  `firewall` carry a 30 s ceiling
  ([write-policy.ts:131-140](../../src/lib/write-policy.ts:131)), so a def's own
  `actionWait` (up to 15 s in this wave) sets the settle delay before the first
  read, and the poll runs out to 30 s (or `settleMs * 2` if that's larger). It
  is still true that `actionWait` never reaches the router on this endpoint —
  `buildWriteRequest()` puts `action_wait` on the wire only on the
  `start_apply` branch ([router-io.ts:231](../../src/lib/router-io.ts:231)) —
  but it now directly governs the extension's own confirmation timing, not
  just an operator's manual timer. The response body is never authoritative
  ([router-io.ts:20-22](../../src/lib/router-io.ts:20)) either way; only a
  matching forced-fresh read sets `verified`.
- **A restart that outlasts the ceiling still reads as *unknown*, not
  *failed*.** Read failures inside the window are recorded but do not end the
  loop; the loop stops early only on a lost session
  ([router-io.ts:360-365](../../src/lib/router-io.ts:360)), reported as such.
  If the window closes with no matching read, `SENT (unconfirmed)` still means
  *unknown* — re-read by hand.
- **Rule-list encoding.** `<` separates records, `>` separates fields, and a
  non-empty list carries a **leading `<`**
  ([rulelist.ts:1-10, :31-32](../../src/lib/rulelist.ts:1)).
- **ascii keys are stored decoded.** `nvramCharToAscii()` runs
  `decodeURIComponent` on the response
  ([router-io.ts:119-134](../../src/lib/router-io.ts:119)); the write path sends
  that decoded string straight back with no re-encoding. Capture and compare
  baselines in decoded form.
- **No product-side snapshot.** The renderer holds a baseline in memory only
  ([SettingsPage.tsx](../../src/ui/SettingsPage.tsx)); it is lost on reload and
  there is no undo. Write baselines down outside the extension.
- **`instance` pages.** `{p}` in every key, and in `rcService`, is substituted at
  the I/O boundary ([SettingsPage.tsx:170-186](../../src/ui/SettingsPage.tsx:170)).
  Baseline the *expanded* keys for the unit you are actually editing.

---

# VPN-tagged paths (7)

## 1. `ipsec-server`

- **File:** [ipsec.ts:189](../../src/pages/defs/ipsec.ts:189) · write block
  [ipsec.ts:335](../../src/pages/defs/ipsec.ts:335)
- **Tag:** `vpn`

**Baseline capture.** `nvram_get`: `ipsec_server_enable`, `ipsec_block_intranet`,
`ipsec_profile_1`. `nvram_char_to_ascii`: `ipsec_client_list_1`,
`ipsec_client_list_2`. Record `ipsec_profile_1` **verbatim, character for
character** — it is a 38-position `>`-joined composite and `buildProfile1()`
rebuilds the entire string from a skeleton plus eight edited positions.

**Smallest test.** `ipsec_block_intranet` (toggle). It is the only plain scalar
on the page that is neither the master enable nor a composite position, and
`buildFields` passes it through untouched, so a bad write cannot corrupt the
38-field composite or the sharded client lists.

**Expected confirmation.** Fresh re-read of `ipsec_block_intranet` returns the
new value; `buildVerify` expects exactly that one key. `ipsec_profile_1` and both
client-list shards must come back **byte-identical to baseline** — check them
even though the verifier will not.

**Known gotchas.**
- `buildProfile1()` unconditionally forces position 37 (`P1_ACTIVATE`) to `'1'`
  whenever *any* profile field changes ([ipsec.ts](../../src/pages/defs/ipsec.ts)
  — `parts[P1_ACTIVATE] = '1'`). Editing the DPD interval also activates the
  profile. Not reachable from this test field, but it governs every other field
  on the page.
- `ipsec_profile_2` (the IKEv2 certificate profile) is regenerated wholesale by
  the native page and is **not** reproduced here — `docs/CURRENT_STATE_AUDIT.md`
  §ipsec-server; also flagged in `STATUS.md` known-open items.
- The client list is split across `_1`/`_2` by a per-account version bitmask
  (`ver & 1` → list1, `ver & 2` → list2), so a dual-version account appears in
  both. `docs/STOCK_VS_MERLIN_DIFF.md` classes `ipsec_client_list_{1..5}` as
  stock-only naming while `docs/CURRENT_STATE_AUDIT.md` models `_1`/`_2` as live
  Merlin reads — **unreconciled; see the flag list in the README.**
- `rcService` is `ipsec_start` for both enable and disable (the def comments
  this): disabling flips the nvram key correctly but sends a restart, not a stop.

**Disruption / wait.** `ipsec_start` restarts the IPsec daemon. Established
IPsec tunnels drop; LAN and WAN are unaffected. No measured figure exists — the
only measured restart in the corpus is `restart_conntrack` at 13–16 ms
(`docs/WRITE_PATH_CHARACTERIZATION.md` §1.6). Re-check at ~10 s.

**Rollback.** Re-write `ipsec_block_intranet` to the baseline value. If
`ipsec_profile_1` or either client-list shard differs from baseline, write the
recorded baseline strings back to those keys directly.

---

## 2. `openvpn-client`

- **File:** [vpn-client.ts:179](../../src/pages/defs/vpn-client.ts:179) · write block
  [vpn-client.ts:397](../../src/pages/defs/vpn-client.ts:397)
- **Tag:** `vpn` · **instance page** (`{p}` = client unit)

**Baseline capture.** For the selected unit *N*: the global
`vpn_clientx_eas`, plus `nvram_get` of `vpn_clientN_`{`if`, `proto`, `addr`,
`port`, `bridge`, `nat`, `fw`, `local`, `remote`, `nm`, `adns`, `rgw`, `gw`,
`enforce`, `crypt`, `userauth`, `useronly`, `cipher`, `hmac`, `digest`, `verb`,
`comp`, `reneg`, `connretry`, `tlsremote`}, plus `nvram_char_to_ascii` of
`vpn_clientN_`{`desc`, `username`, `password`, `ncp_ciphers`, `cn`, `custom3`}.
`vpn_clientx_eas` is global — capture it before touching *any* client unit.

**Smallest test.** `vpn_clientN_desc` (ascii free text, max 25). It is
per-instance, has no effect on tunnel behaviour, and is the one field that
exercises the ascii read/write round-trip without risking the connection. Do
**not** start with "Enable this client": that field is a virtual view whose write
rewrites the shared global `vpn_clientx_eas` for all five units
(`reconcileEasList`, [vpn-client.ts:169](../../src/pages/defs/vpn-client.ts:169)).

**Expected confirmation.** Fresh `nvram_char_to_ascii(vpn_clientN_desc)` returns
the new string decoded. `buildVerify` passes non-enable keys through verbatim, so
the verifier checks exactly this key.

**Known gotchas.**
- The enable toggle is decomposed from the single global comma-list
  `vpn_clientx_eas`; there is no per-instance enable key
  (`docs/CURRENT_STATE_AUDIT.md` §openvpn-client). `encodeEasList` emits a
  **trailing comma** — a round-trip that loses it is a real difference.
- Certificate/key blobs (`vpn_crt_client{p}_*`) are out of scope in this def; a
  write here never touches them.
- `rcService` expands to `restart_vpnclient{p}` — verify the substituted unit
  number in the write log before submitting.
- Choose a `desc` value containing no `<` or `>`: those are the rule-list
  separators and this project performs no escaping.

**Disruption / wait.** `restart_vpnclientN` restarts that one OpenVPN client.
If the client is running and `rgw` routes your traffic, expect a brief loss of
tunnelled connectivity. LAN admin access is unaffected. No measured figure. The
def's `actionWait: 15` is the native page's hint only. Re-check at ~10 s.

**Rollback.** Re-write `vpn_clientN_desc` to the baseline string. Re-read
`vpn_clientx_eas` and confirm it is unchanged.

---

## 3. `wireguard-client`

- **File:** [vpn-client.ts:453](../../src/pages/defs/vpn-client.ts:453) · write block
  [vpn-client.ts:558](../../src/pages/defs/vpn-client.ts:558)
- **Tag:** `vpn` · **instance page** (`{p}` = client unit)

**Baseline capture.** For unit *N*: `nvram_get` of `wgcN_`{`enable`, `nat`, `fw`,
`enforce`, `mtu`, `ep_port`, `alive`}; `nvram_char_to_ascii` of `wgcN_`{`desc`,
`priv`, `addr`, `dns`, `ppub`, `psk`, `aips`, `ep_addr`}. `wgcN_priv` and
`wgcN_psk` are secrets — record them somewhere you would keep a key.

**Smallest test.** `wgcN_desc` (ascii free text). Same reasoning as OpenVPN
client, with one advantage: unlike OpenVPN, **every** WireGuard field here
genuinely has its own per-instance key including `wgcN_enable` (the def documents
`copy_index_to_unindex` in `web.c` as the basis), so there is no shared global to
disturb.

**Expected confirmation.** Fresh `nvram_char_to_ascii(wgcN_desc)` returns the new
string. No `buildVerify` override exists, so the verifier checks the changed keys
verbatim.

**Known gotchas.**
- `rcService` is the bare `restart_wgc` — **not** per-instance, unlike OpenVPN's
  `restart_vpnclient{p}` (`docs/CURRENT_STATE_AUDIT.md` §wireguard-client). A
  write to unit 3 restarts the WireGuard client subsystem, not just unit 3.
- The def notes the native JS conditionally appends `;start_vpnrouting0` when
  `enable`/`enforce` change relative to page-load values — **not modelled**. A
  live enable/enforce change through this page will not refresh VPN Director
  routing the way the native page does.
- `actionWait: 1` in the def is the native page's value and is not sent.

**Disruption / wait.** `restart_wgc` restarts WireGuard client interfaces. Any
active WireGuard tunnel drops. No measured figure. Re-check at ~10 s.

**Rollback.** Re-write `wgcN_desc` to baseline.

---

## 4. `vpn-director`

- **File:** [vpn-director.ts:17](../../src/pages/defs/vpn-director.ts:17) · write block
  [vpn-director.ts:82](../../src/pages/defs/vpn-director.ts:82)
- **Tag:** `vpn`

**Baseline capture.** `nvram_char_to_ascii(vpndirector_rulelist)` — one key, and
the *entire* page state. Record the decoded string exactly, including the leading
`<`. This is a whole-key rewrite on every save: there is no per-row delta.

**Smallest test.** Append **one** disabled rule (`enable` = `0`) to the end of
the existing list, changing nothing else. Rationale: this is a single-key,
whole-value write with no scalar field to hide behind, so the smallest possible
change is one appended record — and an appended record with `enable=0` installs
no routing policy even if it lands. It exercises the serializer's leading-`<`
and field-order behaviour against a real list without altering traffic.

**Expected confirmation.** Fresh `nvram_char_to_ascii(vpndirector_rulelist)`
returns `<baseline-body><0>desc>local>remote>iface`. Compare the whole string
against baseline-plus-appendix — a re-ordered or re-encoded prefix means the
round-trip is not byte-stable and the session should stop there.

**Known gotchas.**
- Record order is `enable > description > localIP > remoteIP > iface`
  (def header, confirmed from the native page's `parseArrayToNvram`).
- `maxRows: 199` ([vpn-director.ts:42](../../src/pages/defs/vpn-director.ts:42)),
  matching the documented 199-rule cap.
- Rules evaluate top-down and **WGC rules take native priority over OVPN rules**
  regardless of list order (def intro) — appending is not the same as
  lowest-priority.
- No `buildVerify` override: the verifier compares the serialized list verbatim,
  so any firmware-side normalisation of the string reads as a failure.

**Disruption / wait.** `restart_vpnrouting0` reprograms policy routing. Sessions
whose routing changes will break; sessions on unaffected paths continue. Adding a
disabled rule should be a no-op in effect. No measured figure. Re-check at ~5 s.

**Rollback.** Write the recorded baseline string back to `vpndirector_rulelist`
in full. Because the page rewrites the whole key, rollback is a single write.

---

## 5. `openvpn-server`

- **File:** [vpn-server.ts:102](../../src/pages/defs/vpn-server.ts:102) · write block
  [vpn-server.ts:477](../../src/pages/defs/vpn-server.ts:477)
- **Tag:** `vpn` · **instance page** (`{p}` = server unit, 1 or 2)

**Baseline capture.** Global `vpn_serverx_start`, plus `nvram_get` of the 30
`vpn_serverN_*` keys listed at
[vpn-server.ts:139-170](../../src/pages/defs/vpn-server.ts:139), plus
`nvram_char_to_ascii(vpn_serverN_ccd_val)`. Capture `vpn_serverx_start` before
touching either unit — it is shared.

**Smallest test.** `vpn_serverN_verb` (OpenVPN log verbosity). It is a plain
scalar, passes through `buildFields` untouched, changes no cryptographic or
network parameter, and its effect is visible in the syslog — which gives you a
second, independent signal that the restart actually happened.

**Expected confirmation.** Fresh `nvram_get(vpn_serverN_verb)` returns the new
value. `vpn_serverx_start` and `vpn_serverN_ccd_val` must be unchanged.

**Known gotchas.**
- The enable toggle is a virtual key (`vpn_server_enable`) that rewrites the
  shared `vpn_serverx_start` comma-list; `ovpnJoinStart` emits a trailing comma
  per token ([vpn-server.ts:60-66](../../src/pages/defs/vpn-server.ts:60)).
- `vpn_serverN_ccd_val` is re-padded with a fixed leading `1` on write
  (`ccdValToStored`, [vpn-server.ts](../../src/pages/defs/vpn-server.ts)) — the
  stored shape is `<1>CN>subnet>netmask>push` but the editor shows four columns.
- `rcService: 'restart_vpnserver{p}'` is a deliberate simplification: the native
  page splits `restart_chpass;restart_vpnserverN` (enabling) vs
  `stop_vpnserverN` (disabling), which a static `WriteDef` cannot express (def
  comment at [vpn-server.ts:479-483](../../src/pages/defs/vpn-server.ts:479)).
- `vpn_serverx_clientlist` (username/password list) is **shared across both
  server instances** and deliberately not modelled (def intro).

**Disruption / wait.** `restart_vpnserverN` restarts that server instance;
connected VPN clients drop and must reconnect. LAN/WAN unaffected. No measured
figure. Re-check at ~15 s (the def's own `actionWait`) — the built-in
verifier's resolved window for `vpn` is now settle 15 s / ceiling 30 s
(`confirmWindow()`, [write-policy.ts:161-179](../../src/lib/write-policy.ts:161)),
not the fixed 10 s this used to say. That window cannot run today regardless —
`vpn` is hard-blocked (see the precondition above) — but once the category is
cleared, this is what it will do.

**Rollback.** Re-write `vpn_serverN_verb` to baseline.

---

## 6. `wireguard-server`

- **File:** [vpn-server.ts:527](../../src/pages/defs/vpn-server.ts:527) · write block
  [vpn-server.ts:568](../../src/pages/defs/vpn-server.ts:568)
- **Tag:** `vpn`

**Baseline capture.** `nvram_get`: `wgs1_enable`, `wgs1_dns`, `wgs1_nat6`,
`wgs1_psk`, `wgs1_alive`, `wgs1_addr`, `wgs1_port`, `wgs1_priv`, `wgs1_pub`.
`wgs1_priv` is the server private key — treat it as a secret and confirm it is
untouched afterwards.

**Smallest test.** `wgs1_alive` (persistent keepalive, 0–65535). Plain numeric
scalar, no list, no key material, and a keepalive change cannot lock anyone out.

**Expected confirmation.** Fresh `nvram_get(wgs1_alive)` returns the new value.
`wgs1_priv` and `wgs1_pub` must be byte-identical to baseline — a key-material
change here would be a serious finding, not a cosmetic one.

**Known gotchas.**
- **This is the one VPN family whose instance-write mechanism is explicitly
  unconfirmed.** `docs/CURRENT_STATE_AUDIT.md` §wireguard-server records that no
  confirmed `validate_instance()` branch exists for direct `wgs1_*` writes that
  bypass the native page's unit-selector indirection; `STATUS.md` calls it a
  flagged leap of faith. Every other VPN instance family rests on the
  `validate_instance()` claim, which is itself sourced only to `STATUS.md`.
  Treat a silent no-op (write returns OK, nvram unchanged) as the expected
  failure mode here, not as a bug in the extension.
- `rcService: 'restart_wgs;restart_dnsmasq'` — a **compound** restart. DNS
  resolution for the whole LAN briefly restarts alongside the VPN server.
- Per-peer families (`wgs1_c1_` … `wgs1_c10_`) are not modelled (def intro), so
  peers are untouched by any write here.
- Read confidence on this page is `structural` — it has never been live-read
  either. Expect the baseline read itself to be the first real test.

**Disruption / wait.** WireGuard server restart drops connected peers;
`restart_dnsmasq` briefly interrupts LAN DNS. Re-check at ~10 s.

**Rollback.** Re-write `wgs1_alive` to baseline.

---

## 7. `pptp-server`

- **File:** [vpn-server.ts:602](../../src/pages/defs/vpn-server.ts:602) · write block
  [vpn-server.ts:684](../../src/pages/defs/vpn-server.ts:684)
- **Tag:** `vpn`

**Baseline capture.** `nvram_get`: `pptpd_enable`, `pptpd_broadcast`,
`pptpd_clients`, `pptpd_mppe`. `nvram_char_to_ascii`: `pptpd_clientlist`.
Record `pptpd_clients` (composite `start_ip-end_octet`, e.g. `192.168.1.1-150`)
and `pptpd_mppe` (integer bitmask) exactly — both are rebuilt from decomposed
virtual fields on write.

**Smallest test.** `pptpd_broadcast` (toggle). It is the only field on the page
that is a plain scalar passed straight through `buildFields` — every other
editable control feeds either the `pptpd_clients` join, the `pptpd_mppe`
bitmask, or the client list.

**Expected confirmation.** Fresh `nvram_get(pptpd_broadcast)` returns the new
value; `pptpd_clients` and `pptpd_mppe` unchanged.

**Known gotchas.**
- `pptpd_mppe` is a bitmask: 128-bit = 1, 40-bit = 4, no-encryption = 8
  ([vpn-server.ts:596-598](../../src/pages/defs/vpn-server.ts:596)). Touching any
  one MPPE toggle rewrites the whole mask from the three current toggle values.
- `pptpd_clients` is split on the **first** `-` only; an end value that is a full
  IP rather than a last octet will not round-trip.
- `rcService: 'restart_pptpd'` for both directions — same enable/disable
  limitation as the OpenVPN server (def comment at
  [vpn-server.ts:686-689](../../src/pages/defs/vpn-server.ts:686)).
- Read confidence is `structural`; nothing on this page has been live-read.

**Disruption / wait.** `restart_pptpd` restarts the PPTP daemon; connected PPTP
clients drop. Re-check at ~10 s.

**Rollback.** Re-write `pptpd_broadcast` to baseline.

---

# Firewall-tagged paths (11)

## 8. `aiprotection`

- **File:** [aiprotection.ts:39](../../src/pages/defs/aiprotection.ts:39) · write block
  [aiprotection.ts:92](../../src/pages/defs/aiprotection.ts:92)
- **Tag:** `firewall`

**Baseline capture.** `nvram_get`: `wrs_protect_enable`, `wrs_mals_enable`,
`wrs_cc_enable`, `wrs_vp_enable`. **Also capture `TM_EULA`** — it is the def's
`eulaGate` key ([aiprotection.ts:48](../../src/pages/defs/aiprotection.ts:48)) but
is *not* in the page's read list, so nothing in the product records it for you.

**Smallest test.** `wrs_mals_enable` (malicious-site blocking). It is one module
of three, gated on its own capability flag, and leaving the master
`wrs_protect_enable` alone means the blast radius is one Trend Micro module
rather than the whole protection stack.

**Expected confirmation.** Fresh `nvram_get(wrs_mals_enable)` returns the new
value. **This is the path where a "verified" result is most likely to be
misleading in the other direction:** see gotchas.

**Known gotchas.**
- **EULA silent-reject.** `docs/EXTERNAL_RESEARCH_RECONCILIATION.md` records that
  writing a Trend Micro operational flag without a satisfied EULA causes the
  backend to *silently reject* it — the documented failure mode is "UI shows the
  feature active while the kernel has refused to load it". If `TM_EULA` is
  unsatisfied, nvram may still accept the value while the module never starts.
  **A green `verifyNvram` result does not prove the module is running.** Confirm
  independently from the router's own AiProtection page or syslog.
- The same doc corrects the EULA endpoint name for this generation to
  `set_ASUS_NEW_EULA.cgi` (the older `set_TM_EULA.cgi` / `set_ASUS_EULA.cgi`
  names are stale) and says to resolve the real names live before relying on
  them. Nothing in this project writes that endpoint.
- `rcService: 'restart_wrs;restart_firewall'` — compound. The firewall restart is
  what puts this page in the excluded category.

**Disruption / wait.** `restart_firewall` reprograms the iptables ruleset for the
whole router. Brief; existing connections generally survive but new-connection
handling is interrupted. No measured figure. Re-check at ~10 s.

**Rollback.** Re-write `wrs_mals_enable` to baseline.

---

## 9. `firewall-general`

- **File:** [firewall.ts:66](../../src/pages/defs/firewall.ts:66) · write block
  [firewall.ts:154](../../src/pages/defs/firewall.ts:154)
- **Tag:** `firewall`

**Baseline capture.** `nvram_get`: `fw_enable_x`, `fw_dos_x`, `fw_log_x`,
`misc_ping_x`, `fw_wl_enable_x`. `nvram_char_to_ascii`: `filter_wllist`. Record
`filter_wllist` **in its stored padded form** — the editor shows a 3-column view
and re-pads to 6 fields on write.

**Smallest test.** `fw_log_x` set to `drop` (or to any value other than its
baseline). It changes only what gets logged: no packet is newly permitted or
denied, so a wrong outcome cannot open or close the firewall. Do **not** start
with `fw_enable_x` — that is the master switch, and several other fields are
`showIf`-gated on it, so flipping it changes what the form even submits.

**Expected confirmation.** Fresh `nvram_get(fw_log_x)` returns the new value.
`filter_wllist` must be byte-identical to baseline (`buildFields` only rewrites
it when `filter_wllist_view` is among the changed keys).

**Known gotchas.**
- `filter_wllist` stored shape is six `>`-separated fields of which 1, 3 and 4
  are always empty: `<proto>>localIP>>>port`
  ([firewall.ts:33-62](../../src/pages/defs/firewall.ts:33)). The view/stored
  conversion is lossy in one direction if a stored record ever carries data in
  the padding positions — this project discards positions 1, 3 and 4 on read
  (`ipv4InboundFromStored` keeps only `c[0]`, `c[2]`, `c[5]`) and re-emits them
  empty. **If any existing record has non-empty padding, editing the list will
  silently drop it.** Check the baseline for this before touching the list.
- This def and `ipv6-firewall` (protocol 13) share one native page,
  `Advanced_BasicFirewall_Content.asp` — 3006.x merged them (file header,
  [firewall.ts:12-16](../../src/pages/defs/firewall.ts:12)). Two views, one page.
- `maxRows: 128` on the inbound list — no doc corroborates this number.

**Disruption / wait.** `restart_firewall`. Re-check at ~10 s.

**Rollback.** Re-write `fw_log_x` to baseline.

---

## 10. `url-filter`

- **File:** [firewall.ts:202](../../src/pages/defs/firewall.ts:202) · write block
  [firewall.ts:263](../../src/pages/defs/firewall.ts:263)
- **Tag:** `firewall`

**Baseline capture.** `nvram_get`: `url_enable_x`, `url_mode_x`.
`nvram_char_to_ascii`: `url_rulelist` — record the **stored** form including the
`1>ALL>` prefix on every record.

**Smallest test.** `url_mode_x` (Black List ⇄ White List) **only if
`url_enable_x` is `0`**. With the filter disabled, the mode field is inert and
the write exercises a plain scalar with no traffic consequence. If the filter is
enabled at baseline, use `url_enable_x` → the value it already has is not a
change, so instead prefer appending one keyword that matches nothing (e.g. a
random 12-character string) and reverting it.

**Expected confirmation.** Fresh `nvram_get(url_mode_x)` returns the new value;
`url_rulelist` byte-identical to baseline.

**Known gotchas.**
- Every record is stored as `1>ALL>keyword` — the first two fields are hard-coded
  by the page on every add/apply, and this def reproduces that in
  `urlKeywordsToStored` ([firewall.ts:191-198](../../src/pages/defs/firewall.ts:191)).
  **A stored record with a different enable flag or LAN scope will be rewritten
  to `1>ALL>` if the list is edited at all.** Inspect the baseline for non-`1`/
  non-`ALL` prefixes first.
- Keyword validation blocks `# % & * { } \ : < > ? / +`
  ([firewall.ts:22-24](../../src/pages/defs/firewall.ts:22)); `maxRows: 64`.
- Switching Black ⇄ White List while the filter is enabled inverts the meaning of
  every existing rule at once. That is why the test is gated on `url_enable_x=0`.

**Disruption / wait.** `restart_firewall`. Re-check at ~10 s.

**Rollback.** Re-write `url_mode_x` to baseline.

---

## 11. `keyword-filter`

- **File:** [firewall.ts:288](../../src/pages/defs/firewall.ts:288) · write block
  [firewall.ts:333](../../src/pages/defs/firewall.ts:333)
- **Tag:** `firewall`

**Baseline capture.** `nvram_get`: `keyword_enable_x`.
`nvram_char_to_ascii`: `keyword_rulelist`.

**Smallest test.** Append one keyword that cannot match real traffic (a random
12-character alphanumeric string) while leaving `keyword_enable_x` at baseline.
Rationale: this page has only two fields, and the enable toggle is the more
consequential of the two — appending a non-matching keyword is the smaller
change and it is the one that exercises the list serializer.

**Expected confirmation.** Fresh `nvram_char_to_ascii(keyword_rulelist)` returns
`<baseline-body><newkeyword>`. Unlike most list pages here, `keyword_rulelist` is
edited **directly** — there is no view key and no `buildFields` override — so the
verifier compares the serialized string verbatim.

**Known gotchas.**
- Single-field records: `serializeRuleList` joins one column per record, so the
  output is `<kw1<kw2<kw3` with no `>` anywhere
  ([rulelist.ts:27-33](../../src/lib/rulelist.ts:27)).
- Same blocked-character set as URL filter; `maxLength: 32` per keyword,
  `maxRows: 64`.
- Read confidence `structural` — the baseline read is itself unproven.
- No `buildVerify`, so any firmware-side normalisation of the list reads as a
  verification failure rather than a difference to investigate.

**Disruption / wait.** `restart_firewall`. Re-check at ~10 s.

**Rollback.** Write the recorded baseline `keyword_rulelist` back in full.

---

## 12. `network-service-filter`

- **File:** [firewall.ts:367](../../src/pages/defs/firewall.ts:367) · write block
  [firewall.ts:494](../../src/pages/defs/firewall.ts:494)
- **Tag:** `firewall`

**Baseline capture.** `nvram_get`: `fw_lw_enable_x`, `filter_lw_default_x`,
`filter_lw_icmp_x`, `filter_lw_date_x`, `filter_lw_time_x`, `filter_lw_time2_x`.
`nvram_char_to_ascii`: `filter_lwlist`. Record `filter_lw_date_x` as the raw
7-character mask.

**Smallest test.** `filter_lw_icmp_x` — the space-separated ICMP type list. It is
a plain scalar with no decomposition, and setting it to an empty string (or back
from empty to its baseline) does not alter the day mask, the time windows, or the
rule list. Do **not** start with a day toggle: `buildFields` recomputes the whole
`filter_lw_date_x` mask from *all* seven current toggle values whenever any one
of them changes ([firewall.ts:498-506](../../src/pages/defs/firewall.ts:498)).

**Expected confirmation.** Fresh `nvram_get(filter_lw_icmp_x)` returns the new
value; `filter_lw_date_x` byte-identical to baseline.

**Known gotchas.**
- `filter_lw_date_x` is a 7-character `0`/`1` mask, **char 0 = Sunday** through
  char 6 = Saturday ([firewall.ts:341-343](../../src/pages/defs/firewall.ts:341)).
  The form renders Mon–Fri before Sat/Sun, so the visual order and the stored
  order differ. A partially-populated or shorter-than-7 baseline mask will be
  re-emitted as a full 7 characters by `joinLwDays` (missing positions become
  `0`).
- Time windows are stored as `HHMMHHMM` in a single field
  ([firewall.ts:362-363](../../src/pages/defs/firewall.ts:362)).
- Filter table type is inverted relative to intuition: `DROP` = White List,
  `ACCEPT` = Black List ([firewall.ts:403-406](../../src/pages/defs/firewall.ts:403)).
- This is the **only firewall page with `read: 'live-verified'`**
  ([firewall.ts:373](../../src/pages/defs/firewall.ts:373)) — the baseline read
  here is more trustworthy than on its siblings.
- Schedule enforcement needs a synchronised clock (section note) — an unsynced
  NTP state changes the observed effect without changing nvram.

**Disruption / wait.** `restart_firewall`. Re-check at ~10 s.

**Rollback.** Re-write `filter_lw_icmp_x` to baseline.

---

## 13. `ipv6-firewall`

- **File:** [firewall.ts:521](../../src/pages/defs/firewall.ts:521) · write block
  [firewall.ts:592](../../src/pages/defs/firewall.ts:592)
- **Tag:** `firewall`

**Baseline capture.** `nvram_get`: `ipv6_fw_enable`. `nvram_char_to_ascii`:
`ipv6_fw_rulelist`. Because this view shares a native page with
`firewall-general`, also record that page's keys (`fw_enable_x`, `fw_dos_x`,
`fw_log_x`, `misc_ping_x`, `fw_wl_enable_x`, `filter_wllist`) so you can tell
whether a write here disturbed the neighbouring view's state.

**Smallest test.** Append one rule with a description only and a port range that
matches nothing you run (e.g. a single high port), leaving `ipv6_fw_enable` at
baseline. Rationale: the enable toggle changes the default-deny posture for **all
inbound IPv6 traffic** at once (def intro) — that is the largest change available
on this page, not the smallest.

**Expected confirmation.** Fresh `nvram_char_to_ascii(ipv6_fw_rulelist)` returns
`<baseline-body><desc>ripaddr>lipaddr>port>proto`. `ipv6_fw_rulelist` is edited
directly with no view key, so the verifier compares verbatim. Confirm
`filter_wllist` and the IPv4 firewall keys are untouched.

**Known gotchas.**
- **3006.x has no dedicated IPv6-firewall `.asp`** — it was merged into
  `Advanced_BasicFirewall_Content.asp` and this project models it as a separate
  view over the same page ([firewall.ts:12-16, :522-524](../../src/pages/defs/firewall.ts:12);
  also `docs/CURRENT_STATE_AUDIT.md` §ipv6-firewall). The two views can disagree
  about what the page's current state is.
- Record order is `desc > remoteIP > localIP > port > proto`
  ([firewall.ts:547](../../src/pages/defs/firewall.ts:547)).
- `proto: OTHER` repurposes the port column as an IP protocol number 1–255
  ([firewall.ts:582-583](../../src/pages/defs/firewall.ts:582)) — the port-range
  validation pattern still applies, so a protocol number must look like a port.
- Gated on `rcSupport.has('ipv6')`; the page will not render without it.

**Disruption / wait.** `restart_firewall`. IPv6 inbound handling is reprogrammed.
Re-check at ~10 s.

**Rollback.** Write the recorded baseline `ipv6_fw_rulelist` back in full.

---

## 14. `parental`

- **File:** [parental.ts:115](../../src/pages/defs/parental.ts:115) · write block
  [parental.ts:162](../../src/pages/defs/parental.ts:162)
- **Tag:** `firewall`

**Baseline capture.** `nvram_get`: `MULTIFILTER_ALL`, `MULTIFILTER_ENABLE`,
`MULTIFILTER_MAC`, `MULTIFILTER_MACFILTER_DAYTIME_V2`. `nvram_char_to_ascii`:
`MULTIFILTER_DEVICENAME`. **Record all four list keys and count the `>`-separated
elements in each.** They are index-aligned parallel lists; if the counts differ at
baseline, the page's recomposition will silently re-align them.

**Smallest test.** `MULTIFILTER_ALL` (the master enable) — **and only when the
four parallel lists are empty at baseline.** Rationale: this page has exactly one
scalar and one virtual list. Every list edit rewrites all four parallel keys at
once via `parentalViewToRaw`
([parental.ts:105-111](../../src/pages/defs/parental.ts:105)), so there is no
"small" list change. With no client rules configured, toggling the master enable
changes nothing operationally and tests the write path in isolation. **If rules
exist at baseline, this page has no safe smallest test** — see the flag list in
the README.

**Expected confirmation.** Fresh `nvram_get(MULTIFILTER_ALL)` returns the new
value; all four list keys byte-identical to baseline.

**Known gotchas.**
- Four `>`-joined, index-aligned lists recomposed into one virtual table and
  decomposed back on write. Losing alignment mis-assigns schedules to devices.
- The schedule column is the **raw encoded V2 daytime token string** (section
  note, [parental.ts:148-150](../../src/pages/defs/parental.ts:148)); the native
  page edits it through a visual weekly grid this table does not reproduce, so
  hand-editing that column is unguarded.
- `docs/CROSS_GENERATION_DIFF.md` notes scheduling lives under `PC_SCHED_V1` on
  5.0 vs `PC_SCHED_V3` on 4.0 — the version numbers move *downward* on the newer
  platform. Do not infer token format from version number.
- Read confidence `structural`.

**Disruption / wait.** `restart_firewall` (iptables-backed). Re-check at ~10 s.

**Rollback.** Re-write `MULTIFILTER_ALL` to baseline. If any list key changed,
write all four recorded baselines back together, not one at a time.

---

## 15. `port-trigger`

- **File:** [wan.ts:371](../../src/pages/defs/wan.ts:371) · write block
  [wan.ts:439](../../src/pages/defs/wan.ts:439)
- **Tag:** `firewall`

**Baseline capture.** `nvram_get`: `autofw_enable_x`.
`nvram_char_to_ascii`: `autofw_rulelist`.

**Smallest test.** `autofw_enable_x` toggled, **provided `autofw_rulelist` is
empty at baseline**. With no trigger rules, the enable flag opens nothing. If
rules exist, instead append one rule using a trigger port you do not use — but
note that an appended rule is live the moment it lands.

**Expected confirmation.** Fresh `nvram_get(autofw_enable_x)` returns the new
value; `autofw_rulelist` byte-identical.

**Known gotchas.**
- Column order is `desc > triggerPort > triggerProto > incomingPort >
  incomingProto` (def header comment,
  [wan.ts:365-368](../../src/pages/defs/wan.ts:365)) — note that *both* protocol
  columns exist and they are independent.
- `maxRows: 32`; description `maxLength: 18`.
- Port fields accept `:` ranges and comma-separated multi-entries
  ([wan.ts:54-56](../../src/pages/defs/wan.ts:54)).
- Read confidence `structural`.

**Disruption / wait.** `restart_firewall`. Re-check at ~10 s.

**Rollback.** Re-write `autofw_enable_x` to baseline.

---

## 16. `port-forwarding`

- **File:** [wan.ts:502](../../src/pages/defs/wan.ts:502) · write block
  [wan.ts:546](../../src/pages/defs/wan.ts:546)
- **Tag:** `firewall`

**Baseline capture.** `nvram_get`: `vts_enable_x`. `nvram_char_to_ascii`:
**both** `vts_rulelist` and `vts1_rulelist`.

**Smallest test.** `vts_enable_x` toggled, **provided both rule lists are empty
at baseline**. Port forwarding is the single highest-consequence page in this
wave — every rule that lands exposes a LAN host to the WAN — so the only genuinely
small test is one that forwards nothing. If rules exist at baseline, do not use
the enable flag; there is no safe alternative on this page and it belongs in the
README flag list.

**Expected confirmation.** Fresh `nvram_get(vts_enable_x)` returns the new value;
both rule lists byte-identical.

**Known gotchas.**
- **Two parallel lists, not one:** `vts_rulelist` for the primary WAN and
  `vts1_rulelist` for the secondary, with the secondary section `showIf`-gated on
  `dualwan_support` ([wan.ts:511-544](../../src/pages/defs/wan.ts:511)). The def
  header records that "dual-format" turned out to mean two lists, not a per-record
  dual encoding ([wan.ts:450-457](../../src/pages/defs/wan.ts:450)). If
  `dualwan_support` is off, `vts1_rulelist` is read but never rendered — so it is
  read into the baseline and can be written back unchanged, but is invisible.
- Column order is `serviceName > externalPort > internalIP > internalPort >
  protocol > sourceIP`; the trailing `sourceIP` column is the 3006 addition
  ([wan.ts:450-456](../../src/pages/defs/wan.ts:450)).
- `docs/CURRENT_STATE_AUDIT.md` records a Secondary-WAN unit hazard on the
  sibling `wan` page (delta writes never post a bare `wan_unit`, so a secondary
  apply could act on unit 0) and is **silent on whether that affects
  `vts1_rulelist`.** Unresolved.
- `maxRows: 64` per list.

**Disruption / wait.** `restart_firewall`. Re-check at ~10 s.

**Rollback.** Re-write `vts_enable_x` to baseline. If either list changed, write
both recorded baselines back.

---

## 17. `dmz`

- **File:** [wan.ts:559](../../src/pages/defs/wan.ts:559) · write block
  [wan.ts:600](../../src/pages/defs/wan.ts:600)
- **Tag:** `firewall`

**Baseline capture.** `nvram_get`: `dmz_ip`, `dmz1_ip`, `sp_battle_ips`,
`wans_mode`. Record whether `dmz_ip` is blank — blank *is* the disabled state.

**Smallest test.** `dmz1_ip` (secondary-WAN exposed host) set from blank to
blank-equivalent is not a change; the usable smallest test is **`dmz_ip`, set
from a non-blank baseline to blank** (i.e. disabling an existing DMZ host). That
direction only ever *removes* exposure. If `dmz_ip` is already blank at baseline,
this page has no test that does not expose a host, and it belongs in the README
flag list.

**Expected confirmation.** Fresh `nvram_get(dmz_ip)` returns the empty string.
Note that an empty-string write is exactly the case where "the key is missing"
and "the key is empty" look the same — confirm the read returns a present key
with an empty value, not an absent key.

**Known gotchas.**
- **There is no `dmz_enable` key.** Enabled/disabled is derived purely from
  whether `dmz_ip` is blank, and the native page clears it on submit when the
  operator picks "No" (def intro,
  [wan.ts:567-568](../../src/pages/defs/wan.ts:567)).
- `dmz1_ip` is only rendered when `dualwan_support` **and** `wans_mode === 'lb'`
  ([wan.ts:589](../../src/pages/defs/wan.ts:589)) — it is read into the baseline
  either way.
- `sp_battle_ips` is `readonly` in this view and managed by the router itself;
  it should never appear in a write payload.
- Read confidence `structural`.

**Disruption / wait.** `restart_firewall`. Re-check at ~10 s.

**Rollback.** Re-write `dmz_ip` to the recorded baseline address.

---

## 18. `nat-passthrough`

- **File:** [wan.ts:725](../../src/pages/defs/wan.ts:725) · write block
  [wan.ts:780](../../src/pages/defs/wan.ts:780)
- **Tag:** `firewall`

**Baseline capture.** `nvram_get`: `fw_pt_pptp`, `fw_pt_l2tp`, `fw_pt_ipsec`,
`fw_pt_rtsp`, `fw_pt_h323`, `fw_pt_sip`, `fw_pt_pppoerelay`, `pppoerelay_unit`,
`vts_ftpport`, `wans_mode`.

**Smallest test.** `fw_pt_h323` (H.323 passthrough). All seven passthrough
fields are independent plain scalars with identical mechanics, so pick the one
least likely to be in use: H.323 is a legacy videoconferencing helper, whereas
SIP, IPSec, PPTP and L2TP passthrough are all plausibly load-bearing on a live
network. Do **not** start with `fw_pt_pppoerelay` — it is the one field with a
dependent (`pppoerelay_unit`) and it is the one the second half of the compound
restart script exists for.

**Expected confirmation.** Fresh `nvram_get(fw_pt_h323)` returns the new value.
No `buildFields`/`buildVerify` overrides on this page — the changed key is
submitted and verified verbatim.

**Known gotchas.**
- **The key family is `fw_pt_*`, not `*_passthrough`.** Any inherited note
  referring to `*_passthrough` keys does not match this firmware; no such key
  appears in the source or in any doc.
- `rcService: 'restart_firewall;restart_pppoe_relay'` — the only **compound**
  restart among the firewall pages ([wan.ts:782](../../src/pages/defs/wan.ts:782)).
  `restart_pppoe_relay` runs even when you changed an unrelated passthrough
  toggle.
- `fw_pt_sip_mode` exists in firmware source but is hard-gated to
  `based_modelid == "BRT-AC828"` and never renders here — deliberately omitted
  (def intro, [wan.ts:733-734](../../src/pages/defs/wan.ts:733)).
- `pppoerelay_unit` renders only when `fw_pt_pppoerelay === '1'` **and**
  `dualwan_support` **and** `wans_mode === 'lb'`
  ([wan.ts:768](../../src/pages/defs/wan.ts:768)).
- Read confidence `structural`.

**Disruption / wait.** `restart_firewall` plus `restart_pppoe_relay`. If a PPPoE
relay session is active it will drop. Re-check at ~10 s.

**Rollback.** Re-write `fw_pt_h323` to baseline.
