# rc/ Source Findings — closing the "blocked, source unavailable" gaps

Date: 2026-07-31. Author pass: rc-source acquisition + research (DECISIONS
D-028).

## Why this document exists

Through every prior pass, one GPL package was missing from the vendored
firmware trees in `RAW/`: `release/src/router/rc/`, the init/service-script
layer. All four originally-vendored trees carried only `httpd/`, `shared/`,
and `www/`. That gap left a recurring class of question unanswerable from
source — anything about what a `restart_*` / `start_*` / `stop_*` rc action
*actually does* on the router. Several OPEN_LOOPS entries and def-header
caveats were marked "blocked, source unavailable" or "UNCONFIRMED" solely
for that reason.

This pass acquired `rc/` for **both active Merlin generations**, matched to
the versions already vendored:

- `RAW/merlin-rc` — tag `3006.102.7_2` (ASUSWRT 5.0, RT-BE92U class), 154
  source files.
- `RAW/merlin-3004-rc` — tag `3004.388.11` (ASUSWRT 4.0, RT-AX88U class),
  131 source files.

Source-only (per-model prebuilt `rc/prebuild/**/*.o` binaries excluded —
they are the "every router" bloat and carry no source value). Both are
sparse partial clones of `RMerl/asuswrt-merlin.ng`; `RAW/` is gitignored, so
neither affects this repo. Acquisition method (for reproducibility) is
recorded in the pass's scratch plan and DECISIONS D-028 — the notable
Windows wrinkles were illegal colon-paths under `udev/test/` (avoided by a
pathspec-scoped checkout that never walks them) and a partial-clone lazy
fetch that does not fire on `checkout -- pathspec` (forced by batching the
tree's blob OIDs through `git cat-file` first).

Everything below is read-only source analysis. No router was contacted; no
downloaded source was executed. Findings hold for both generations except
where a difference is called out.

## 1. VPN daemon stop-vs-restart semantics

Closes OPEN_LOOPS "rc daemon stop-vs-restart behavior — blocked, source
unavailable"; confirms DECISIONS D-010 and the shipped fix `1b92640`.

- **PPTP** (full source present, `rc/vpn.c` ~99-118, both generations):
  `start_pptpd()` checks `pptpd_enable` and no-ops when off. So calling the
  restart action alone *does* leave the daemon stopped when disabled — the
  old static-restart approach was **not harmful at the daemon level** for
  PPTP. Native still never restarts-to-disable (`Advanced_VPN_PPTP.asp:434`
  sends bare `stop_pptpd`), and couples `;restart_samba` only to the enable
  path, gated on `enable_samba==1`.
- **IPsec** (`rc/rc_ipsec.c` ~2449/2689): dispatched by literal
  `ipsec_start`/`ipsec_stop`/`ipsec_restart` script names (not the
  `start_/stop_/restart_` prefix mechanism). `rc_ipsec_set()` unconditionally
  self-terminates charon/starter based on a trailing enable-flag check
  regardless of which verb called it, so `ipsec_restart` alone correctly ends
  stopped. Minor caveat: a possible transient start-then-stop within one
  shell invocation on the first call after cold boot.
- **OpenVPN server**: the dispatcher (`rc/services.c` ~20740 / ~17793 for
  3004) unconditionally runs stop+start, but whether the daemon self-gates on
  the enable flag resolves into prebuilt `libovpn.so` — **still not in
  source**. This does not block the conclusion: native's own web JS
  (`Advanced_VPN_OpenVPN.asp:629-634`) never restarts-to-disable — it always
  sends bare `stop_vpnserverN` on disable — and the shipped D-010 fix matches
  that dispatch behavior exactly.

**Net:** the concern that motivated D-010 was real only in the
unconfirmable-OpenVPN case and demonstrably harmless at the daemon level for
PPTP/IPsec; the shipped direction-branched fix matches native for all three
regardless. The loop is resolved, not merely unblocked.

## 2. WireGuard server: unit 2 and peer key generation

Confirms the second-instance and peer features shipped this pass, and
retires two "UNCONFIRMED" caveats in `vpn-server.ts`.

- **Unit 2 is a genuine, functional second instance**, not an nvram-layer
  artifact. `start_wgsall`/`stop_wgsall` loop `1..WG_SERVER_MAX` (=2,
  `shared/vpn_utils.h:141`) and `start_wgs(unit)`/`stop_wgs(unit)`
  (`rc/wireguard.c` ~1446-1628) are fully unit-parametrized
  (`prefix="wgs%d_"`, `ifname="wgs%d"`), reading `wgs2_*` exactly as
  `wgs1_*`. `restart_wgs 2` dispatches to `start_wgs(2)`
  (`rc/services.c` ~22018). The only honest remaining caveat is that fresh
  `wgs2_*` reads come back empty until first written (no seeded defaults).
- **Peer keypair generation is automatic in rc**, not a client
  responsibility. `_wg_server_gen_keys()` / `_wg_server_gen_client_keys()`
  (`rc/wireguard.c` ~960-1037) shell out to `wg genkey`/`pubkey`/`genpsk`
  and `nvram set` the results idempotently (only when empty), invoked from
  `start_wgs()` and the live single-peer update path. The peer editor
  therefore only needs to write `wgs1_c{n}_enable`/`addr`/`aips` (+psk
  toggle) and trigger a restart — rc fills in the keys.
- **Minimal-disruption note:** native's live per-peer path uses
  `restart_wgsc <server_unit> <client_unit>` (BOTH args, else the handler
  defaults server unit to 1 — `rc/services.c` ~22030); this project issues a
  full `restart_wgs`, which is correct but bounces the whole interface.
- 3004 and 3006 are functionally equivalent here (line-shifted only; 3006
  adds an extra `unit` arg to `_wg_server_nf_add` for SDN firewall binding,
  irrelevant to the above).

## 3. Download Master — stay read-only, now source-backed

Confirms the read-only decision and adds a concrete hazard.

- Full path: `web.c:ej_apps_action` → `notify_rc()` → nvram `rc_service` →
  `handle_notifications()` (`rc/services.c` ~15688) → `apps_` dispatch
  (~18714-18755) → `_eval()` execs `/usr/sbin/app_*.sh` (runtime optware
  artifacts, not in source).
- `check_cmd_whitelist()` is **still closed-source even with rc/ added** —
  `extern`-only in `httpd.h:480`, otherwise only inside prebuilt per-model
  `web_hook.o`. The neighboring `notify_rc.c` is explicitly headed
  "UNPUBLISHED PROPRIETARY SOURCE CODE" (`notify_rc.h:24-27`): deliberate
  non-disclosure.
- **Hazard:** `handle_notifications()` splits `rc_service` on `;` as a
  command separator *before* argv tokenizing (`rc/services.c` ~15709-15751).
  `apps_name`/`apps_flag` are attacker-controllable JSON fields concatenated
  via `snprintf` and gated only by the unverifiable whitelist, so a smuggled
  `;` could inject a second, independent rc_service directive (e.g. `reboot`)
  — a genuine injection primitive into the rc-service mini-language. The
  final exec is argv-safe (`_eval`, no shell); the exposure is one layer up.
- **Design constraint this imposes** on any future guarded dedicated-CGI
  write path (see OPEN_LOOPS): the extension must sanitize `;` (and validate
  against the rc-service tokenizer) in *any* value that can reach an
  `rc_service` field, rather than trust the firmware's closed-source gate.
- 3004 and 3006 identical here.

## 4. SDN service internals — design validated

Confirms the SDN CRUD feature's design (shipped hard-blocked under
'wireless').

- `restart_sdn` / `sdn_del` are `rc_service` tokens dispatching to
  `handle_sdn_feature(...)` (`rc/sdn.c:31`) / `remove_sdn()` (`rc/sdn.c:884`).
  Neither calls `restart_wireless()` or touches radios — that is plumbing
  (iptables/dnsmasq/routing) only. "Every SDN apply hits wireless" is true
  because httpd always batches `restart_wireless;restart_sdn;`
  (`web.c:23200` et al.), not a hard rc coupling. `restart_wireless()`
  (`rc/lan.c` ~6569-7033) is a full radio bounce but contains **no `reboot()`
  call** — it never escalates to reboot-class. This is why the feature's
  deliberate exclusion of VLAN-trunk/port-binding (which native *does*
  escalate) keeps our scoped writes off any reboot path.
- The `nvram_modified_sdn` gap (subnet_rl/sdn_access_rl posted without
  sdn_rl would skip `sync_apgx_to_wlunit`) is real in `web.c` but a no-op for
  the SDN CRUD endpoints, which call `sync_apgx_to_wlunit(NULL)`
  unconditionally after writing `sdn_rl` (`web.c:43466` et al.) — and this
  project's editor always posts `sdn_rl` with any change anyway.
- **MAINFH has no server-side named guard** — zero `MAINFH`/`MAINBH`
  references in rc/; the only incidental protection is `remove_sdn()`
  skipping teardown when `ifname == lan_ifname` (`rc/sdn.c` ~897). This
  confirms the protection is client-JS-only in native and **validates the
  extension's decision to make the `apm`/MAINFH family structurally
  untouchable** rather than rely on any firmware backstop.
- **3004 has no SDN at all** (no `sdn.c`, no `MULTILAN_CFG`); guest
  networking there is the legacy per-band VIF model
  (`wl0_vifnames`/`wl1_vifnames`, `rc/init.c` ~16772) plus `gn_wbl.c` ACLs —
  structurally incompatible with the SDN model. A concrete cross-generation
  fact for the compatibility matrix.

## 5. Time Machine, Notification Center, USB accounts

- **Time Machine:** `restart_timemachine` → `stop_timemachine(0)` +
  `start_timemachine()` (`rc/services.c` ~20886), a plain stop/start pair.
  But `find_mountpoint()` (`rc/timemachine.c` ~298-325) always returns
  `/tmp/mnt/<tm_device_name>` regardless of whether that is a real mount; the
  only gate is `check_if_dir_exist()`, whose body ships closed-source in
  `shared/`. A `tm_device_name` containing path traversal that resolved to a
  real directory would be AFP-shared. **The extension is already defended:**
  `usb.ts`'s `tm_device_name` field validates `^[a-zA-Z0-9]*$`, which cannot
  express `/` or `.`, so the extension can never originate a traversal
  payload (documented inline at that field as a security boundary, not just a
  format hint). No code change was needed; the finding elevated an existing
  incidental restriction to a known-load-bearing one.
- **Notification Center:** `start/stop_notification_center()` only
  spawn/kill the `nt_monitor`/`nt_center` daemons (`rc/services.c`
  ~12746-12772). An exhaustive search of the generic rc_service dispatcher
  found **no mark-read / `nt_apply` path in rc at all** — stronger than "runs
  but no-ops": there is no `notify_rc` for it, so mark-read genuinely never
  reaches the service layer. This fully validates the `writeExclusion: null`
  tag on the shipped mark-read action. (Caveat: the `nt_center` daemon's own
  source is not in `RAW`, so daemon-internal reactivity to the event DB file
  can't be ruled out — but it is not driven by the write this project
  issues.)
- **USB accounts:** `add_account`/`del_account`/`mod_account`/`set_permission`
  are **confirmed absent from the entire `RAW` tree** (called but never
  defined) — still closed-source, so the deferred account-write feature must
  go through the firmware's own CGI handlers, not by replicating `acc_list`
  directly (which would skip invisible validation). New detail: `start_samba()`
  (`rc/usb.c` ~3449-3630) bulk-reprovisions *all* accounts from `acc_list`
  via `smbpasswd`/`tsmb-passwd` on every restart, rather than incremental
  add/del. Reinforces the OPEN_LOOPS "guarded dedicated-CGI write extension"
  entry: the write path is the dedicated CGI, and its validation is not
  reproducible from source.

## Residual unconfirmables (honest gaps)

These need `shared/` (not fetched this pass) or are genuinely closed-source:
`sync_apgx_to_wlunit()` / `get_mtlan()` bodies, `check_if_dir_exist()`,
`check_cmd_whitelist()`, `notify_rc.c`, `libovpn.so`'s internal enable check,
and the `nt_center` daemon. None are load-bearing for the conclusions above;
each is noted where it applies.
