# Wave 4 — Routine write paths

**16 protocols.** Every write path carrying **no** `writeExclusion` tag
(`writeExclusion: null`), except `tweaks` — which is the project's one
already-live-verified write and is excluded from protocol work.

This is preparation material. It does not authorise, schedule, or recommend any
session. Deciding whether a session happens, and running it, is the operator's.

---

## What makes this wave different

Nothing here is in `HARD_EXCLUDED_WRITE_CATEGORIES`
([write-policy.ts:46](../../src/lib/write-policy.ts:46)) and nothing carries a
diagnostic exclusion tag either. These 16 paths are governed **only** by the
global read-only interlock. They are the shortest route from "never submitted" to
"live-verified", and they are the right place to establish that the project's
`applyapp.cgi` delta-write assumption generalises beyond the single field it has
actually been proven on.

That last point is the reason this wave matters more than its low risk suggests.
`docs/WRITE_PATH_CHARACTERIZATION.md` §5 proves exactly one delta write —
`action_mode=apply&aae_disable_force=1` — and states plainly of it: *"This does
not generalize on its own. One field, one page, one session."* `STATUS.md`
§write-config nonetheless adopts `applyapp.cgi` delta writes as policy for every
settings page, on the strength of a reading of httpd's `validate_apply()` that
appears in no other document. Every protocol in this file is, incidentally, a
test of that policy.

---

## Mechanics that apply to every protocol in this file

- **Transport.** All 16 use `applyapp.cgi`. Thirteen are declarative
  `write` blocks; three are direct `guardedWrite()` call sites in custom
  components ([wol.tsx:49](../../src/pages/defs/wol.tsx:49),
  [wol.tsx:72](../../src/pages/defs/wol.tsx:72),
  [site-survey.tsx:89](../../src/pages/defs/site-survey.tsx:89)).
- **Confirmation scales per category, and `actionWait` is not inert.**
  `guardedWrite()` resolves the confirmation window via `confirmWindow()` from
  each def's `actionWait` and `writeExclusion` category
  ([write-guard.ts:135](../../src/lib/write-guard.ts:135);
  [write-policy.ts:161-179](../../src/lib/write-policy.ts:161)), rather than
  using `verifyNvram()`'s own bare 10 000 ms / 800 ms defaults
  ([router-io.ts:321-322](../../src/lib/router-io.ts:321)). Every path in this
  wave is untagged (`writeExclusion: null`), which floors the ceiling at 30 s
  regardless of the def's own `actionWait`
  ([write-policy.ts:143](../../src/lib/write-policy.ts:143)), since none of
  their `actionWait` values are large enough to widen it further. `actionWait`
  is still never sent on the wire on this endpoint — only `start_apply` puts it
  in the form body ([router-io.ts:231](../../src/lib/router-io.ts:231)) — but it
  now sets the verifier's settle delay directly. `tweaks` and `traffic-settings`
  omit `actionWait` entirely, so those two settle immediately and poll out to
  the bare 30 s category floor. Response bodies are never authoritative
  ([router-io.ts:20-22](../../src/lib/router-io.ts:20)) regardless.
- **Two paths pass `null` as `verifyKeys`** (WOL wake, Site Survey rescan). When
  `verifyKeys` is null or empty, `guardedWrite()` skips verification and reports
  `applied` from `result.ok` — i.e. **from the HTTP status of a response the
  project's own I/O layer says means nothing**
  ([write-guard.ts:128-132](../../src/lib/write-guard.ts:128)). Those two
  protocols need out-of-band confirmation; it is called out in each.
- **Rule lists:** `<` record, `>` field, leading `<` on a non-empty list
  ([rulelist.ts:1-10, :31-32](../../src/lib/rulelist.ts:1)).
- **ascii keys are stored decoded** ([router-io.ts:119-134](../../src/lib/router-io.ts:119));
  no re-encoding on write.
- **No product-side snapshot or undo.** Baselines go on paper.

---

## 1. `system`

- **File:** [admin.ts:122](../../src/pages/defs/admin.ts:122) · write block
  [admin.ts:353](../../src/pages/defs/admin.ts:353)
- **Tag:** none

**Baseline capture.** `nvram_get`: `http_enable`, `http_lanport`,
`https_lanport`, `misc_http_x`, `misc_httpport_x`, `misc_httpsport_x`,
`captcha_enable`, `http_autologout`, `enable_acc_restriction`, `telnetd_enable`,
`usb_idle_enable`, `usb_idle_timeout`, `nat_redirect_enable`,
`reboot_schedule_enable`, `reboot_schedule`. `nvram_char_to_ascii`:
`restrict_rulelist`. **Record `reboot_schedule` as the raw 11-character string**
(7-day mask + HHMM) — it is rebuilt from decomposed virtual fields on write.

**Smallest test.** `usb_idle_timeout` (USB disk spin-down timeout, seconds). It
is a plain integer that touches nothing about web-UI reachability. Everything
else on this page is in the blast radius of your own session: `http_enable`,
`http_lanport`, `https_lanport`, `misc_http*` and `enable_acc_restriction` all
govern how you are connected right now, and `restart_httpd` is in the restart
chain. `usb_idle_timeout` is the one field whose wrong value costs a disk that
spins at the wrong time.

**Expected confirmation.** Forced-fresh `nvram_get(usb_idle_timeout)` returns the
new value. `reboot_schedule` byte-identical to baseline — `buildFields` only
rewrites it when a day toggle or `reboot_hour`/`reboot_min` is among the changed
keys ([admin.ts:353-370](../../src/pages/defs/admin.ts:353)).

**Known gotchas.**
- **The restart chain includes `restart_httpd`** — the daemon serving your
  session. `rcService: 'restart_time;restart_httpd;restart_upnp'`
  ([admin.ts:358](../../src/pages/defs/admin.ts:358)). Expect the admin session to
  be briefly interrupted regardless of which field you changed, and expect
  `verifyNvram` to be racing an httpd restart.
- **The rcService value is a documented simplification.** The def comment records
  that this is the page's *static default* hidden field, used verbatim, while the
  native `applyRule()` reconstructs the value dynamically per changed field
  ([admin.ts:354-356](../../src/pages/defs/admin.ts:354)). Separately,
  `docs/STOCK_VS_MERLIN_DIFF.md` records stock as `restart_time;restart_upnp;`
  and Merlin as `restart_time;restart_leds;` — **the shipped string matches
  neither.** Unresolved; flagged in the README.
- `reboot_schedule` is 7 day-mask characters followed by zero-padded HH and MM
  (`joinRebootSchedule`, [admin.ts:114-118](../../src/pages/defs/admin.ts:114)).
  A short or malformed baseline is re-emitted as a full 11 characters.
- Login credentials (`http_username`/`http_passwd`) and HTTPS certificate
  management are deliberately not modelled (def intro).
- `telnetd_enable` is present as a field but the native UI force-hides the control
  on current-gen models (`docs/CURRENT_STATE_AUDIT.md` §system) — this view
  exposes something the router's own page does not.
- Read confidence `live-verified`.

**Disruption / wait.** **Brief service restart**, including the web server.
Def `actionWait: 5`. Expect a reconnect. Allow ~15 seconds before re-reading.

**Rollback.** Re-write `usb_idle_timeout` to baseline; second httpd restart.

---

## 2. `system-time`

- **File:** [admin.ts:430](../../src/pages/defs/admin.ts:430) · write block
  [admin.ts:470](../../src/pages/defs/admin.ts:470)
- **Tag:** none

**Baseline capture.** `nvram_get`: `time_zone`, `ntp_server0`, `ntp_server1`,
`ntpd_enable`, `ntpd_server_redir`. Five plain keys, nothing ascii, no lists.

**Smallest test.** `ntp_server1` (the secondary NTP server, a Merlin addition,
max 255). It is free text, it is the *secondary* server so the primary keeps the
clock synchronised regardless, and it is the only field here that is not either
the time zone (which shifts every timestamp and every schedule on the router at
once) or a local-ntpd gate. Setting it to a well-known public pool address, or
clearing it, are both defined outcomes.

**Expected confirmation.** Forced-fresh `nvram_get(ntp_server1)` returns the new
value. `time_zone` byte-identical.

**Known gotchas.**
- **`time_zone` is a curated ~24-entry subset of the native ~90-entry list**
  (`docs/CURRENT_STATE_AUDIT.md` §system-time). The doc's position is that
  unlisted zones still round-trip safely — but if the baseline `time_zone` is not
  in `TIME_ZONE_OPTIONS`, it is an out-of-list select value. Confirm the baseline
  is in the list before touching this page, and prefer not to change `time_zone`
  at all.
- **Changing the time zone changes schedule semantics elsewhere.** The
  network-service-filter schedule (Wave 1 protocol 12) and the `system` page's
  reboot schedule are both wall-clock. This is a cross-page coupling with no
  coordination in the code.
- `rcService: 'restart_time'` — a **narrower** script than the `system` page's
  three-part chain, even though both edit the same native form
  (`docs/CURRENT_STATE_AUDIT.md` §system-time calls it a per-category override).
  No live evidence backs the narrowing.
- The local-NTP section is `showIf`-gated on `ntpd_support`;
  `ntpd_server_redir` on `ntpd_enable === '1'`
  ([admin.ts:453, :464](../../src/pages/defs/admin.ts:453)).
- `ntp_ready` appears in no source file and no doc — any inherited note naming it
  does not match this def.
- Read confidence `live-verified`.

**Disruption / wait.** **Brief service restart.** `restart_time` restarts time
synchronisation only; the web UI is not in the chain. Def `actionWait: 5`.
Allow ~10 seconds.

**Rollback.** Re-write `ntp_server1` to baseline.

---

## 3. `ssh`

- **File:** [admin.ts:483](../../src/pages/defs/admin.ts:483) · write block
  [admin.ts:545](../../src/pages/defs/admin.ts:545)
- **Tag:** none

**Baseline capture.** `nvram_get`: `sshd_enable`, `sshd_forwarding`, `sshd_port`,
`sshd_pass`, `sshd_authkeys`. Record `sshd_authkeys` **in full** — it is a
multi-line textarea up to 2999 characters and it is the credential that keeps
key-based access working.

**Smallest test.** `sshd_port`, **and only if `sshd_enable` is `0` at baseline**.
With SSH disabled the port field is inert, and the write exercises a plain
integer with no access consequence. If SSH is enabled at baseline, changing the
port moves a live administrative service, and the smaller test is `sshd_pass`
**in the permissive direction only** (`0` → `1`, allowing password login) —
because the restrictive direction can lock out an operator whose key is not
correctly installed. Never start with `sshd_authkeys`.

**Expected confirmation.** Forced-fresh `nvram_get(sshd_port)` returns the new
value; `sshd_authkeys` byte-identical to baseline.

**Known gotchas.**
- **`sshd_forwarding` is hard-excluded from live testing by operator scoping** —
  stated in the field's own hint ([admin.ts:509-512](../../src/pages/defs/admin.ts:509))
  and independently in `docs/WRITE_PATH_CHARACTERIZATION.md` §4, same class as
  HTTPS cert regen and UPnP pinholes. It is on this page and must not be the test
  field. (Noting where the boundary is; not proposing to move it.)
- **`sshd_authkeys` is read as plain `nvram_get`, not ascii**
  ([admin.ts:494](../../src/pages/defs/admin.ts:494)) — unlike every other
  free-text multi-line field in the project. How newlines survive a plain
  `nvram_get`/`applyapp` round-trip is **not documented anywhere**, and no doc
  addresses write-side encoding at all. Treat any authorized-keys edit as an
  encoding experiment, not a routine write.
- `rcService: 'restart_time;restart_httpd;restart_upnp'` — the same static default
  as the `system` page, because it is the same native form. The def comment
  records that no `restart_sshd` token appears in this page's JS
  ([admin.ts:546-549](../../src/pages/defs/admin.ts:546)). **So there is no
  guarantee dropbear picks up a changed port or key set without a further
  action**; nvram will be correct and the daemon may not be.
- `docs/STOCK_VS_MERLIN_DIFF.md` classes `sshd_authkeys` as stock-only naming
  ("check before use") while `docs/CURRENT_STATE_AUDIT.md` models it as a live
  Merlin key. Unresolved; flagged in the README.
- Every field except `sshd_enable` is `showIf`-gated on `sshd_enable !== '0'`.
- Merlin-only page, gated on `ssh_support`. Read confidence `live-verified`.

**Disruption / wait.** **Brief service restart including `restart_httpd`** —
expect the admin session to be interrupted. Def `actionWait: 5`. Allow ~15 s.

**Rollback.** Re-write `sshd_port` to baseline.

---

## 4. `dns-director`

- **File:** [dnsdirector.ts:113](../../src/pages/defs/dnsdirector.ts:113) · write block
  [dnsdirector.ts:213](../../src/pages/defs/dnsdirector.ts:213)
- **Tag:** none

**Baseline capture.** `nvram_get`: `dnsfilter_enable_x`, `dnsfilter_mode`,
`dnsfilter_custom1`, `dnsfilter_custom2`, `dnsfilter_custom3`,
`dnsfilter_custom61`, `dnsfilter_custom62`, `dnsfilter_custom63`.
`nvram_char_to_ascii`: **all six shard keys** — `dnsfilter_rulelist`,
`dnsfilter_rulelist1` … `dnsfilter_rulelist5`. Record each shard separately
**and** their concatenation, and note each shard's length.

**Smallest test.** `dnsfilter_custom3` (the third custom resolver slot) set from
empty to a known-good address, or cleared if already set — **but only if it is
not referenced by any rule in the list.** It is a plain scalar that
`buildFields` passes straight through, so the write cannot touch the six shards.
Every other candidate is worse: `dnsfilter_mode` changes the global redirection
for all unlisted clients at once, `dnsfilter_enable_x` gates the whole feature,
and any list edit rewrites all six shards.

**Expected confirmation.** Forced-fresh `nvram_get(dnsfilter_custom3)` returns
the new value. **All six shard keys byte-identical to baseline** — this is the
important check, because a shard-boundary bug would not be visible in the view.

**Known gotchas.**
- **Six-way sharding with a hard 255-character-per-shard cap.**
  `RULE_SHARD_KEYS` × `SHARD_LEN = 255`
  ([dnsdirector.ts:67-75](../../src/pages/defs/dnsdirector.ts:67)).
  `rulesToShards` re-slices the *whole* concatenated string at fixed 255-byte
  boundaries on every write — so editing one rule can change the contents of
  every shard, and a rule record can be split across a shard boundary mid-field.
  Total capacity is 6 × 255 = 1530 characters; **`rulesToShards` silently
  discards anything past that** (it slices six windows and keeps no remainder).
  With `maxRows: 64` ([dnsdirector.ts:197](../../src/pages/defs/dnsdirector.ts:197))
  and a record shape of `<>MAC>mode` (~22 characters), 64 rules is roughly 1400
  characters — close enough to the ceiling that a long-mode-value list could
  approach it.
- Record shape is `<>MAC>mode` — a **vestigial empty first field** (the source
  comments it "Formerly name field") plus MAC and preset mode
  ([dnsdirector.ts:77-81](../../src/pages/defs/dnsdirector.ts:77)). The editor
  shows two columns; the stored form has three.
- **rcService disagreement.** This def sends `restart_dnsfilter`
  ([dnsdirector.ts:215](../../src/pages/defs/dnsdirector.ts:215));
  `docs/STOCK_VS_MERLIN_DIFF.md` records the DNS Director action_script as
  `restart_dnsmasq`. Unresolved; flagged in the README.
- Merlin-only page, gated on `dnsfilter_support`. Read confidence
  `live-verified`.

**Disruption / wait.** **Brief service restart.** DNS redirection rules are
reprogrammed; if `restart_dnsmasq` is what actually runs, LAN DNS resolution
blips. Def `actionWait: 5`. Allow ~10 seconds.

**Rollback.** Re-write `dnsfilter_custom3` to baseline. If any shard changed,
write **all six** recorded baseline shards back together — writing them
individually can leave the concatenation inconsistent between writes.

---

## 5. `qos`

- **File:** [qos.ts:119](../../src/pages/defs/qos.ts:119) · write block
  [qos.ts:206](../../src/pages/defs/qos.ts:206)
- **Tag:** none (explicitly *not* firewall-excluded, per operator scoping)

**Baseline capture.** `nvram_get`: `qos_enable`, `qos_type`, `qos_overhead`,
`qos_atm`, `qos_mpu`, `qos_obw`, `qos_ibw`. **Record `qos_obw` and `qos_ibw` in
their stored kilobit form** — the UI edits them in Mb/s and converts.
Also record `TM_EULA` (the def's `eulaGate` key,
[qos.ts:126](../../src/pages/defs/qos.ts:126)), which is not in the read list.

**Smallest test.** `qos_overhead` (per-packet overhead in bytes). It is a plain
integer that passes straight through `buildFields`, it only refines the shaper's
accounting, and it cannot enable or disable QoS. `qos_enable` and `qos_type`
change the entire traffic-shaping regime; `qos_obw`/`qos_ibw` go through the
Mb↔Kb conversion and are the fields most likely to expose a rounding bug.

**Expected confirmation.** Forced-fresh `nvram_get(qos_overhead)` returns the new
value; `qos_obw` and `qos_ibw` byte-identical to baseline.

**Known gotchas.**
- **Bandwidth values are stored in Kb/s and edited in Mb/s**, with `0`/blank
  meaning Auto (`kbToMbpsAuto` / `mbpsAutoToKb`,
  [qos.ts:100-131](../../src/pages/defs/qos.ts:100)). The conversion is
  `Math.round(n * 1024)` in one direction — **it is not guaranteed to be a
  lossless round-trip** for values that are not clean multiples. If you ever test
  `qos_obw`, verify against the *converted* expectation, not the Mb/s value you
  typed.
- **EULA silent-reject applies here too.** Adaptive QoS (`qos_type` values
  requiring Trend Micro) is subject to the same documented behaviour as
  AiProtection: writing an operational flag without a satisfied EULA is silently
  rejected by the backend while the UI shows it as set
  (`docs/EXTERNAL_RESEARCH_RECONCILIATION.md`). A green verify does not prove the
  feature is running.
- `rcService: 'restart_qos;restart_firewall'` — compound, and it includes a
  firewall restart. The page is nonetheless tagged `null` by explicit operator
  scoping (`docs/CURRENT_STATE_AUDIT.md` §qos records this as deliberate). Worth
  knowing before the session: a "routine" write here restarts the firewall.
- `qos_mpu` and `qos_atm` are Cake-only and capability-gated
  ([qos.ts:200-206](../../src/pages/defs/qos.ts:200)); Cake is `qos_type` 9.
- **No bwdpi nvram key names are documented anywhere** — only capability flags.
  This def touches none.
- Read confidence `live-verified`.

**Disruption / wait.** **Brief service restart**, QoS plus firewall. Existing
connections generally survive; new-connection handling and shaping are
interrupted. Def `actionWait: 15` is now the built-in verifier's own settle
delay too, within the untagged category's 30 s ceiling
([write-policy.ts:143](../../src/lib/write-policy.ts:143)) — the extension
should verify within that window on a successful write rather than plausibly
reporting `SENT (unconfirmed)`.

**Rollback.** Re-write `qos_overhead` to baseline.

---

## 6. `qos-rules`

- **File:** [qos.ts:237](../../src/pages/defs/qos.ts:237) · write block
  [qos.ts:332](../../src/pages/defs/qos.ts:332)
- **Tag:** none

**Baseline capture.** `nvram_get`: `qos_default`. `nvram_char_to_ascii`:
`qos_rulelist`.

**Smallest test.** `qos_default` (default priority for unclassified traffic),
**and only when `qos_type` on the `qos` page is not Traditional QoS** — this
page only takes effect under Traditional QoS (def intro,
[qos.ts:245-246](../../src/pages/defs/qos.ts:245)). Under any other QoS type the
field is inert and the write is a pure mechanism test. If Traditional QoS *is*
active, changing the default priority re-classifies all unmatched traffic at
once; in that case the smaller change is appending one rule matching an unused
high port.

**Expected confirmation.** Forced-fresh `nvram_get(qos_default)` returns the new
value; `qos_rulelist` byte-identical.

**Known gotchas.**
- `qos_default` is a **real nvram key that the native page does not expose as a
  distinct control** — the def infers it from `shared/defaults.c` and the rule
  list's own 0–4 priority scale (field hint,
  [qos.ts:257-258](../../src/pages/defs/qos.ts:257)). There is no native UI to
  cross-check it against, and no native page to roll it back from.
- `maxRows: 128` on `qos_rulelist` ([qos.ts:274](../../src/pages/defs/qos.ts:274))
  — from the def alone; **no doc states a cap for this key.**
- `qos_rulelist` is edited directly (no view key, no `buildFields` override), so
  the verifier compares the serialized list verbatim.
- `rcService: 'restart_qos;restart_firewall'` — compound, includes a firewall
  restart.
- Read confidence **`structural`** ([qos.ts:243](../../src/pages/defs/qos.ts:243))
  — never live-read.

**Disruption / wait.** **Brief service restart**, QoS plus firewall. Def
`actionWait: 5`. Allow ~10 seconds.

**Rollback.** Re-write `qos_default` to baseline.

---

## 7. `bandwidth-limiter`

- **File:** [qos.ts:381](../../src/pages/defs/qos.ts:381) · write block
  [qos.ts:444](../../src/pages/defs/qos.ts:444)
- **Tag:** none

**Baseline capture.** `nvram_get`: `qos_bw_rulelist` — **note the plain
`nvram_get`, not ascii** ([qos.ts:391](../../src/pages/defs/qos.ts:391)). That is
one key and the entire page state. Record it exactly.

**Smallest test.** Append one rule targeting a MAC address that is not on the
network, with generous limits, **and only when `qos_type` is not Bandwidth
Limiter** — this page only takes effect under that type (def intro,
[qos.ts:391](../../src/pages/defs/qos.ts:391)). Rationale: this page has exactly
one field, so there is no scalar to fall back on; the smallest possible change is
one appended record, and an unused-MAC target limits nothing even if it lands.

**Expected confirmation.** Forced-fresh `nvram_get(qos_bw_rulelist)` returns
`<baseline-body><0>target>dl>ul>prio`, in the **stored** shape produced by
`bwRuleListToStored`, not the four-column view shape.

**Known gotchas.**
- **This is the one rule list in the project deliberately read as plain
  `nvram_get` rather than `nvram_char_to_ascii`**
  ([qos.ts:391](../../src/pages/defs/qos.ts:391); corroborated at
  `docs/CURRENT_STATE_AUDIT.md` §bandwidth-limiter, "plain `nvram_get` not
  ascii"). Do not apply ascii-key assumptions here; if the stored value contains
  characters a plain `nvram_get` mangles, the round-trip will not be byte-stable
  and that is what this test would surface.
- Stored record is `enable > target > download_kb > upload_kb > priority`
  (def comment at [qos.ts:377-379](../../src/pages/defs/qos.ts:377)); the editor
  shows a re-padded view via `bwRuleListFromStored`/`bwRuleListToStored`.
- **Bandwidth values are stored in Kb/s and edited in Mb/s** (section note,
  [qos.ts:399](../../src/pages/defs/qos.ts:399)) — same conversion caveat as the
  `qos` page.
- `maxRows: 32` ([qos.ts:405](../../src/pages/defs/qos.ts:405)); Network Map
  device-group targeting (`@group`) is not modelled (section note).
- `rcService: 'restart_qos;restart_firewall'` — compound, includes a firewall
  restart. Def `actionWait: 15`, which is within the untagged category's 30 s
  verifier ceiling ([write-policy.ts:143](../../src/lib/write-policy.ts:143)),
  not above it.
- Read confidence `live-verified`.

**Disruption / wait.** **Brief service restart**, QoS plus firewall. The
built-in verifier now settles for 15 s (the def's `actionWait`) and polls out
to the 30 s category ceiling — expect it to verify within that window on a
successful write, not to report `SENT (unconfirmed)`.

**Rollback.** Write the recorded baseline `qos_bw_rulelist` back in full.

---

## 8. `samba`

- **File:** [usb.ts:59](../../src/pages/defs/usb.ts:59) · write block
  [usb.ts:159](../../src/pages/defs/usb.ts:159)
- **Tag:** none

**Baseline capture.** `nvram_get`: `enable_samba`, `computer_name`,
`st_samba_workgroup`, `smbd_protocol`, `smbd_simpler_naming`, `smbd_master`,
`smbd_wins`, `st_max_user`, `usb_fs_ntfs_sparse`. Nine plain keys, nothing ascii,
no lists.

**Smallest test.** `st_max_user` (maximum concurrent login users). It is a plain
integer; raising it changes nothing for existing sessions and lowering it only
affects *new* connections. Deliberately **not** `smbd_protocol`: the def and
`docs/CURRENT_STATE_AUDIT.md` both flag the SMB protocol-version field as too
risky to live-test because it could break an in-progress mount, and the operator
independently named "SMB protocol" a do-not-propose field
(`docs/WRITE_PATH_CHARACTERIZATION.md` §4). `enable_samba` and `smbd_master` also
disrupt active mounts.

**Expected confirmation.** Forced-fresh `nvram_get(st_max_user)` returns the new
value. No `buildFields`/`buildVerify` overrides — verbatim submit and verify.

**Known gotchas.**
- `st_max_user` is **shared with the `ftp` page**
  ([usb.ts:76](../../src/pages/defs/usb.ts:76) and
  [usb.ts:178](../../src/pages/defs/usb.ts:178)) — one key, two views, no
  coordination. A change here shows up on the FTP page and vice versa. Note this
  before attributing an unexpected value to a failed write.
- `rcService: 'restart_ftpsamba;restart_dnsmasq'` — **compound, and it restarts
  DNS**. A Samba setting change briefly interrupts LAN DNS resolution. That is
  surprising enough to be worth stating before the session, not during it.
- Per-account and per-group share permissions go through separate `aidisk.cgi`
  endpoints and are not modelled (def intro) — nothing here touches them.
- `smbd_protocol` is Merlin-only nvram (`docs/STOCK_VS_MERLIN_DIFF.md`).
- Read confidence **`structural`** ([usb.ts:64](../../src/pages/defs/usb.ts:64)).

**Disruption / wait.** **Brief service restart**: file sharing plus DNS. Active
SMB mounts may drop. Def `actionWait: 5`. Allow ~10 seconds.

**Rollback.** Re-write `st_max_user` to baseline. Remember it is shared with
`ftp` — confirm the FTP page's view of it afterwards.

---

## 9. `ftp`

- **File:** [usb.ts:172](../../src/pages/defs/usb.ts:172) · write block
  [usb.ts:237](../../src/pages/defs/usb.ts:237)
- **Tag:** none

**Baseline capture.** `nvram_get`: `enable_ftp`, `ftp_wanac`, `ftp_tls`,
`st_max_user`, `ftp_lang`. Five plain keys.

**Smallest test.** `ftp_lang` (the FTP server's codepage). It is a select over a
closed set of language codes and it affects only filename character encoding for
new sessions. `enable_ftp` starts or stops the service; `ftp_wanac` exposes FTP
to the WAN (the highest-consequence field on the page by a wide margin); `ftp_tls`
changes the transport security requirement and can break existing clients;
`st_max_user` is shared with `samba`.

**Expected confirmation.** Forced-fresh `nvram_get(ftp_lang)` returns the new
value.

**Known gotchas.**
- **`st_max_user` is shared with `samba`** — see protocol 8. It is in this page's
  read list and will be in the baseline for both.
- `rcService: 'restart_ftpsamba'` — note this restarts **Samba too**, not just
  FTP. `docs/STOCK_VS_MERLIN_DIFF.md` lists a Merlin action_script `restart_ftpd`
  which this def does not use; no doc reconciles the two. Flagged in the README.
- **This firmware branch has no FTP port or passive-mode fields** — only WAN
  access, TLS, user limit and codepage are configurable (def intro,
  [usb.ts:180-182](../../src/pages/defs/usb.ts:180)). Any inherited note about
  `st_ftp_*` keys does not match: no such key appears in the source or any doc.
- Read confidence **`structural`**.

**Disruption / wait.** **Brief service restart** of both FTP and Samba. Active
transfers and mounts may drop. Def `actionWait: 5`. Allow ~10 seconds.

**Rollback.** Re-write `ftp_lang` to baseline.

---

## 10. `mediaserver`

- **File:** [usb.ts:275](../../src/pages/defs/usb.ts:275) · write block
  [usb.ts:369](../../src/pages/defs/usb.ts:369)
- **Tag:** none

**Baseline capture.** `nvram_get`: `daapd_enable`, `daapd_friendly_name`,
`dms_enable`, `dms_friendly_name`, `dms_dir_manual`, `dms_rebuild`, `dms_web`.
`nvram_char_to_ascii`: **both** `dms_dir_x` and `dms_dir_type_x`. Record both
lists and **count the records in each** — they are index-aligned and must stay
the same length.

**Smallest test.** `dms_friendly_name` (the DLNA server's advertised name, free
text). It is a plain scalar that passes straight through `buildFields`, so it
cannot disturb the two parallel directory lists, and its only effect is the label
clients see. `dms_rebuild` triggers a full media re-scan; `dms_enable` and
`daapd_enable` start/stop services; `dms_dir_manual` changes whether the
directory list is honoured at all.

**Expected confirmation.** Forced-fresh `nvram_get(dms_friendly_name)` returns
the new value. `dms_dir_x` and `dms_dir_type_x` byte-identical, **and still the
same record count as each other.**

**Known gotchas.**
- **`dms_dir_x` and `dms_dir_type_x` are two SEPARATE `<`-delimited lists kept in
  sync by record index** — not one joined `path>type` list (def comment at
  [usb.ts:283-285](../../src/pages/defs/usb.ts:283)). The editor presents them as
  one two-column table via `dmsDirsFromStored`/`dmsDirsToStored`. If the two
  lists have different lengths at baseline, the recomposition will re-align them
  and one list will change length. **Check the counts match before editing.**
- The bare key `dms_dir` does not exist; it is `dms_dir_x`. Any inherited note
  using the short form does not match.
- `maxRows: 10` on the directory list
  ([usb.ts:353](../../src/pages/defs/usb.ts:353)) — from the def alone; **no doc
  states a cap.**
- The iTunes/DAAP section is `showIf`-gated on `!noiTunes_support`.
- `rcService: 'restart_media'`. Read confidence **`structural`**.

**Disruption / wait.** **Brief service restart** of the media server. Streaming
clients drop and re-discover. Def `actionWait: 5`. Allow ~10 seconds. A friendly-
name change may take longer than that to propagate to clients via SSDP — that is
a client-side effect, not a write failure.

**Rollback.** Re-write `dms_friendly_name` to baseline.

---

## 11. `nfs`

- **File:** [usb.ts:404](../../src/pages/defs/usb.ts:404) · write block
  [usb.ts:459](../../src/pages/defs/usb.ts:459)
- **Tag:** none

**Baseline capture.** `nvram_get`: `nfsd_enable`, `nfsd_enable_v2`.
`nvram_char_to_ascii`: `nfsd_exportlist`.

**Smallest test.** `nfsd_enable_v2` (NFSv2 compatibility), **provided
`nfsd_exportlist` is empty at baseline**. With no exports defined, neither
enable flag exposes anything. If exports exist, `nfsd_enable_v2` is still the
smaller of the two flags — it only widens or narrows protocol-version support for
an already-running service, whereas `nfsd_enable` starts or stops it.

**Before the session, check `nfsd_support`.** It reads **`0`** on the operator's
RT-BE92U (`docs/LIVE_PROBE_RT-BE92U.md` §2; `STATUS.md` records the gate-off
observed live hiding the nav entry). **A write here would target a subsystem that
is disabled on this unit.** The nvram key should still accept the value — that is
in fact a clean isolated test of the write mechanism with zero service impact —
but do not expect any observable NFS behaviour change, and do not read its
absence as a failed write.

**Expected confirmation.** Forced-fresh `nvram_get(nfsd_enable_v2)` returns the
new value; `nfsd_exportlist` byte-identical.

**Known gotchas.**
- **The key is `nfsd_exportlist`, not `nfs_exportlist`**
  ([usb.ts:422](../../src/pages/defs/usb.ts:422)); the short form appears nowhere.
- `maxRows: 32` ([usb.ts:448](../../src/pages/defs/usb.ts:448)) — from the def
  alone; **no doc states a cap.** Columns are `path > accesslist > options`.
- The `gate` on `nfsd_support` affects **nav visibility only** — the page itself
  serves over direct navigation regardless, confirmed live
  ([usb.ts:409-416](../../src/pages/defs/usb.ts:409)).
- `rcService: 'restart_nasapps'` — a **broad** script: it restarts the NAS
  application group, not just nfsd. Expect Samba/FTP/media to be affected too.
- Merlin-only page. Read confidence `live-verified` (the page renders and reads
  even with the support flag off).

**Disruption / wait.** **Brief service restart** across the NAS application
group. Def `actionWait: 5`. Allow ~10 seconds.

**Rollback.** Re-write `nfsd_enable_v2` to baseline.

---

## 12. `ddns`

- **File:** [wan.ts:613](../../src/pages/defs/wan.ts:613) · write block
  [wan.ts:712](../../src/pages/defs/wan.ts:712)
- **Tag:** none (deliberately: `restart_ddns` is not on the excluded-restart list)

**Baseline capture.** `nvram_get`: `ddns_enable_x`, `ddns_wan_unit`,
`ddns_server_x`, `ddns_hostname_x`, `ddns_username_x`, `ddns_passwd_x`,
`ddns_wildcard_x`, `ddns_regular_check`, `wans_mode`. **`ddns_passwd_x` is a
provider credential read as plain `nvram_get`** — record it as a secret.

**Smallest test.** `ddns_regular_check` (periodically verify the DDNS record
still points here — a Merlin addition,
[wan.ts:703-707](../../src/pages/defs/wan.ts:703)). It is a plain toggle that
changes only whether a periodic verification runs; it cannot deregister a
hostname or change what is published. `ddns_hostname_x` changes what is
registered, `ddns_server_x` changes the provider (and re-gates three other fields
via `showIf`), and the credential fields can break the registration.

**Expected confirmation.** Forced-fresh `nvram_get(ddns_regular_check)` returns
the new value; `ddns_hostname_x`, `ddns_username_x` and `ddns_passwd_x`
byte-identical.

**Known gotchas.**
- **This page is inside `wan.ts` but is deliberately untagged.** The file header
  states it explicitly: `restart_ddns` is not on the excluded-restart list, but
  `confidence.write` stays `unverified-write` because nothing in the category has
  been live-submitted ([wan.ts:43-46](../../src/pages/defs/wan.ts:43)). It is in
  Wave 4 by its tag, not by its neighbourhood.
- **Key-name disagreement.** This def uses `ddns_regular_check`
  ([wan.ts:631](../../src/pages/defs/wan.ts:631)); `docs/STOCK_VS_MERLIN_DIFF.md`
  names the Merlin periodic-refresh key on this page `ddns_refresh_x`. The def
  intro separately says `ddns_regular_period` / `ddns_refresh_x` rows are
  permanently `display:none` on the native page and are not modelled
  ([wan.ts:620-621](../../src/pages/defs/wan.ts:620)) — so the two names may be
  different controls rather than a contradiction, but **nothing confirms
  `ddns_regular_check` is the live key.** Flagged in the README: this is the
  smallest-test field, so it is exactly the claim the session would be resting
  on. Verify the key exists in the baseline read before writing it.
- **Credentials are plain `nvram_get`, not ascii** — inconsistent with the `wan`
  page's PPPoE credentials, which *are* ascii
  ([wan.ts:108](../../src/pages/defs/wan.ts:108) vs
  [wan.ts:623-633](../../src/pages/defs/wan.ts:623)). No doc explains the
  difference. A DDNS password containing characters a plain `nvram_get` mangles
  would not round-trip.
- Let's Encrypt issuance (`restart_ddns_le;prepare_cert`) and webdav/ftpd
  cert-reload branches are not modelled (def intro).
- `ddns_wan_unit` renders only under `dualwan_support` **and**
  `wans_mode === 'lb'` ([wan.ts:649](../../src/pages/defs/wan.ts:649)); most
  other fields are `showIf`-gated on `ddns_server_x`.
- Read confidence **`structural`**.

**Disruption / wait.** **Brief service restart** of the DDNS client only. No
network interruption. Def `actionWait: 10`. Allow ~15 seconds.

**Rollback.** Re-write `ddns_regular_check` to baseline.

---

## 13. `traffic-settings`

- **File:** [traffic.tsx:290](../../src/pages/defs/traffic.tsx:290) · write block
  [traffic.tsx:363](../../src/pages/defs/traffic.tsx:363)
- **Tag:** none

**Baseline capture.** `nvram_get`: `rstats_enable`, `rstats_path`,
`rstats_stime`, `rstats_offset`, `rstats_data`, `rstats_colors`,
`rstats_exclude`, `rstats_bak`. Eight plain keys. Note that `rstats_data` and
`rstats_colors` are read but **not rendered as fields** — they are in the read
list only, so they will never appear in a delta.

**Smallest test.** `rstats_offset` (first day of the monthly cycle, 1–31). It is
a plain integer within a validated range; it changes how the monthly view is
bucketed and does not affect collection itself. `rstats_enable` stops collection;
`rstats_path` changes where history is persisted and a wrong path silently means
"RAM, lost on reboot" (field hint,
[traffic.tsx:341](../../src/pages/defs/traffic.tsx:341)); `rstats_stime` changes
save frequency and therefore how much history is at risk.

**Expected confirmation.** Forced-fresh `nvram_get(rstats_offset)` returns the
new value. No `buildFields`/`buildVerify` overrides.

**Known gotchas.**
- **This def carries no `actionWait` at all**
  ([traffic.tsx:363-366](../../src/pages/defs/traffic.tsx:363)). That's still
  correct as far as this def goes — no per-path wait was ever transcribed for
  this write — but not because the field is inert: `actionWait` now directly
  sets the built-in verifier's settle delay when a def supplies one
  ([write-policy.ts:161-179](../../src/lib/write-policy.ts:161)). Omitting it
  simply means this path settles for 0 ms and polls straight out to the
  untagged category's 30 s ceiling. Only `tweaks` does the same.
- Changing `rstats_offset` **re-buckets existing history**; the monthly view will
  show different totals for the same underlying data. That is expected, not a
  corruption.
- `rstats_path` empty means RAM — history is lost on reboot. Worth confirming the
  baseline value before a session that will itself involve restarts.
- **No encoding rule is documented for `rstats_exclude`** (a comma-separated
  interface list, per the field hint). It is read as plain `nvram_get` with no
  ascii handling.
- Merlin-only page (`rstats_path` / `rstats_stime` are Merlin additions per
  `docs/STOCK_VS_MERLIN_DIFF.md`), behind `trafficHistoryGate`. Read confidence
  `live-verified`.

**Disruption / wait.** **Brief service restart** of the rstats collector only.
No network interruption. Allow ~10 seconds.

**Rollback.** Re-write `rstats_offset` to baseline.

---

## 14. `wol` — save the WOL target list

- **File:** [wol.tsx:72](../../src/pages/defs/wol.tsx:72) (`saveList`) · custom
  component, def at [wol.tsx:204](../../src/pages/defs/wol.tsx:204)
- **Tag:** none

**Baseline capture.** `nvram_char_to_ascii(wollist)` — one key, the whole page
state. Record the decoded string including its leading `<`.

**Smallest test.** Append **one** entry with a name and a MAC address that
belongs to no device (a locally-administered address such as
`02:00:00:00:00:01`). Rationale: this path has exactly one key and rewrites it
wholesale on every save, so one appended record is the smallest possible change —
and a WOL target that matches no hardware is inert until someone presses Wake on
it. Deletion is the alternative and is worse: it destroys data you would then
have to restore from your own notes.

**Expected confirmation.** `guardedWrite` is called with
`{ wollist: serialized }` as `verifyKeys`
([wol.tsx:79](../../src/pages/defs/wol.tsx:79)), so `verifyNvram` polls
`nvram_get(wollist)` and compares against the serialized string. **Note the
asymmetry:** the baseline is read through `nvram_char_to_ascii`
([wol.tsx:32](../../src/pages/defs/wol.tsx:32)) but verification reads through
plain `nvram_get` (`verifyNvram` → `nvramGet`,
[router-io.ts:274](../../src/lib/router-io.ts:274)). If any name in the list
contains a character the two read paths treat differently, verification will
report a mismatch that is a read-path artefact, not a failed write. Confirm by
re-reading with `nvram_char_to_ascii` yourself.

**Known gotchas.**
- Two-column records `name>mac` ([wol.tsx:19](../../src/pages/defs/wol.tsx:19)),
  serialized with the standard leading `<`. **No `maxRows` is set** on
  `WOL_SPEC` — there is no row cap in the code and none in any doc.
- `docs/CURRENT_STATE_AUDIT.md` §wol describes `wollist` as **both** "plain
  nvram" and "nvram(ascii)" within the same row. The code reads it as ascii and
  verifies it as plain — which is exactly the ambiguity the doc leaves open.
  Flagged in the README.
- Names containing `<` or `>` will corrupt the list: there is no escaping
  anywhere in `serializeRuleList`
  ([rulelist.ts:27-33](../../src/lib/rulelist.ts:27)). Use a plain alphanumeric
  test name.
- The MAC field is validated against `MAC_PATTERN`
  ([wol.tsx:18](../../src/pages/defs/wol.tsx:18)) before the Add button enables.

**Disruption / wait.** **None.** No `rcService` is set on this call site
([wol.tsx:73-78](../../src/pages/defs/wol.tsx:73)), so no restart directive is
sent — the request is a bare `action_mode=apply&wollist=…`. This is the least
disruptive write path in the project and, for that reason, a reasonable place to
start a first-ever live session. Re-check immediately.

**Rollback.** Write the recorded baseline `wollist` back in full — a single
write, also with no restart.

---

## 15. `wol` — the wake action (`SystemCmd` / `' Refresh '`)

- **File:** [wol.tsx:49](../../src/pages/defs/wol.tsx:49) (`wake`) · custom
  component, def at [wol.tsx:204](../../src/pages/defs/wol.tsx:204)
- **Tag:** none

**Baseline capture.** **There is no nvram state to capture** — this path writes
nothing to nvram. What to record instead: the exact request the read-only preview
produces (URL and body, shown in the outcome banner,
[wol.tsx:196](../../src/pages/defs/wol.tsx:196)), and the power state of the
target device before the wake.

**Smallest test.** There is only one thing this path does. The smallest safe form
of it is a wake targeting a **MAC address that belongs to no device on the
network** — the packet is broadcast and simply wakes nothing. That exercises the
entire `action_mode=' Refresh '` / `SystemCmd` branch without depending on a
device's WOL configuration to interpret the result. Only after that works should
a real target be used, and then the confirmation is the device powering on.

**Expected confirmation.** **The `verifyNvram()` discipline does not apply here
and cannot be made to.** `guardedWrite` is called with `null` as `verifyKeys`
([wol.tsx:57](../../src/pages/defs/wol.tsx:57)), so the guard skips verification
entirely and reports `applied` from `result.ok` — the HTTP status of a response
the project's own I/O layer states is never authoritative
([write-guard.ts:128-132](../../src/lib/write-guard.ts:128);
[router-io.ts:20-22](../../src/lib/router-io.ts:20)). The UI's `DONE` badge on
this path therefore means "the router returned 2xx", nothing more.

The only real confirmation is **out of band**: the target device powers on, or a
packet capture on the LAN shows the magic frame. Plan for one or the other before
the session; there is no in-extension signal that means anything.

**Known gotchas.**
- **`action_mode` is the literal string `' Refresh '` — with a leading and a
  trailing space** ([wol.tsx:53](../../src/pages/defs/wol.tsx:53);
  [router-io.ts:162-164](../../src/lib/router-io.ts:162)). Whether the padding is
  required, whether the branch is allow-listed server-side, and what it does with
  `SystemCmd` are **not documented anywhere** — the httpd-side branch appears in
  no doc in the corpus. This is the least-understood write path in the project.
- The command sent is `ether-wake -i br0 -b <MAC>`
  ([wol.tsx:54](../../src/pages/defs/wol.tsx:54)) — the interface `br0` is
  hard-coded. On a unit whose LAN bridge is not `br0`, the command fails
  server-side and nothing here would report it.
- The MAC is interpolated into a shell-style command string with no escaping. The
  UI gates the Wake button on `MAC_PATTERN`
  ([wol.tsx:109](../../src/pages/defs/wol.tsx:109)) for manual entry, but the
  per-row Wake buttons pass `row[1]` straight through
  ([wol.tsx:135](../../src/pages/defs/wol.tsx:135)) — i.e. whatever is stored in
  `wollist`, unvalidated. **Confirm the stored MACs are well-formed before using
  a row's Wake button.**
- No `rcService` is set; `currentPage` is `Main_WOL_Content.asp`.

**Disruption / wait.** **None to the router.** No restart directive, no nvram
change. The only effect is a broadcast frame on the LAN. Re-check immediately.

**Rollback.** **Not applicable — and that is the point.** This path has no
rollback because it has no persisted state: it is a fire-and-forget command. The
consequence of an unintended wake is a device powering on, which is undone by
powering it off, not by this tool.

---

## 16. `site-survey` — rescan trigger

- **File:** [site-survey.tsx:89](../../src/pages/defs/site-survey.tsx:89)
  (`rescan`) · custom component, def at
  [site-survey.tsx:171](../../src/pages/defs/site-survey.tsx:171)
- **Tag:** none

**Baseline capture.** No nvram is written, so there is no rollback value to
record. Capture instead: the current `wlc_scan_state` (read from `/apscan.asp`,
[site-survey.tsx:56](../../src/pages/defs/site-survey.tsx:56)) and the current AP
list, so you can tell whether the scan actually re-ran.

**Smallest test.** As with the WOL wake, this path does exactly one thing and it
cannot be made smaller. The mitigating choice available is **timing**: run it at a
moment when a brief scan-induced interruption on the wireless bands is
acceptable, and from a wired connection.

**Expected confirmation.** **`verifyNvram()` does not apply here either** —
`guardedWrite` is called with `null` as `verifyKeys`
([site-survey.tsx:99](../../src/pages/defs/site-survey.tsx:99)). The component
does not even use the `applied` flag; it checks `result.entry.submitted` and
starts polling ([site-survey.tsx:103-106](../../src/pages/defs/site-survey.tsx:103)).

The real confirmation is behavioural: `wlc_scan_state` reads `5` when a scan
cycle is complete (def header,
[site-survey.tsx:5-6](../../src/pages/defs/site-survey.tsx:5)), and the component
polls `/apscan.asp` every 3 seconds until it sees that
([site-survey.tsx:82-86](../../src/pages/defs/site-survey.tsx:82)). A refreshed AP
list with plausibly-changed signal values is the second signal.

**Known gotchas.**
- **This is a scan trigger, not a settings write** — it changes no configuration
  (def header comment,
  [site-survey.tsx:6-8](../../src/pages/defs/site-survey.tsx:6); the
  `writeExclusion: null` is annotated in-line at
  [site-survey.tsx:92-94](../../src/pages/defs/site-survey.tsx:92) explaining why
  it is not tagged `wireless`).
- **But the docs never adjudicate whether it falls inside the wireless
  exclusion.** `docs/WRITE_PATH_CHARACTERIZATION.md` §4 excludes wireless actions
  partly because of "risk of disconnecting the session running the test" and does
  **not** name `restart_wlcscan` either way. **No documentation exists on whether
  a radio rescan disrupts associated clients**, nor on scan duration, nor on the
  full semantics of `wlc_scan_state`. Flagged in the README — this is a genuine
  gap, not a conservative reading.
- The request carries `fields: { flag: 'sitesurvey' }` and
  `rcService: 'restart_wlcscan'`
  ([site-survey.tsx:95-96](../../src/pages/defs/site-survey.tsx:95)) — `flag` is
  not an nvram key, which is why there is nothing to verify.
- `restart_wlcscan` is a **Merlin-only** action_script
  (`docs/STOCK_VS_MERLIN_DIFF.md`). The SITE_SURVEY function is Merlin-only,
  installed when `HND_ROUTER=y`, and **had a security fix in 3006.102.7_2** — the
  operator's build. Confirm the running build before relying on older notes about
  this feature.
- Read confidence is `live-verified` for the `/apscan.asp` parse
  ([site-survey.tsx:180](../../src/pages/defs/site-survey.tsx:180)).

**Disruption / wait.** **Unknown, and that is the finding.** A radio scan
plausibly interrupts association on the scanning band, but nothing in the corpus
measures or even asserts it. Treat it as "wireless may blip for the duration of
the scan", run it from a wired connection, and expect the component's own
polling to take up to tens of seconds to see `wlc_scan_state === '5'`.

**Rollback.** **Not applicable** — no persisted state is changed. A scan runs and
finishes.
