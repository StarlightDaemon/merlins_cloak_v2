# Live Probe — RT-BE92U Running Merlin (3006.102.7_2)

Live-router session against the operator's actual RT-BE92U at `192.168.1.1`,
answering the open questions left by
[`STOCK_VS_MERLIN_DIFF.md`](STOCK_VS_MERLIN_DIFF.md) and
[`CROSS_GENERATION_DIFF.md`](CROSS_GENERATION_DIFF.md). Read-only: every
request was a GET, no form was submitted, no control was clicked, no
reboot/upgrade/apply action was triggered.

**Privacy note on method:** several pages visited during this probe render the
operator's live private data — configured SSIDs, DHCP static-lease MAC
addresses and device names, an active WireGuard client's public IP/peer
key/handshake state, and hundreds of live tracked connections with real
external IPs and device labels. None of those raw values are reproduced
below; findings are described structurally (page renders / errors / status
code) without the underlying private content.

---

## 1. Summary

| Question (from prior reports) | Resolution |
|---|---|
| `state.js` support-flag *values* (source-only, couldn't be read statically) | **Sampled live** — full table in §2. `rc_support` nvram string captured too. |
| Which `menuTree_*.js` is the real live source? | **Confirmed by network trace**: `GET /require/modules/menuTree.js` (§3), not inferred from DOM. |
| AiCloud: changelog says removed, `cloud_*.asp` still in source — what happens at runtime? | **All six pages 404.** Removal is real; source presence was a red herring (§4). |
| Does BE92U stock's SDN (`mtlancfg_support`) surface in Merlin's live nav? | **Yes** — "Network" page exposes SDN/Guest Network Pro UI, `mtlancfg_support` live value is `6` (§5). |
| Does Merlin's 1517-line `web.c` diff break the read path an extension would use? | **No** — authenticated same-origin GET to a representative data endpoint succeeded (200, session reused) (§6). |
| Source presence ≠ served page — does this hold up live? | Confirmed both directions: AiCloud pages present in source but 404 live; `Advanced_VPN_OpenVPN.asp` (stock deletes at install) present in source **and** live on this Merlin unit (§7). One page (`Advanced_WAdvanced_Content.asp`) renders fully but throws a console exception — a new finding not visible from source alone (§7). |

**Deviation from plan:** `start_apply.htm` was not visited — the browser
session's own safety classifier blocked navigation to it before any request
left the machine, treating the filename pattern as a potential mutating
action even though only a bare GET was requested. This is consistent with
the read-only constraint for this session and is treated as "correctly
withheld," not as a router-side result.

---

## 2. Live flag values (Task 1)

Read via JavaScript executed in the authenticated home-page context. `state.js`
parses the nvram `rc_support` token string at load time and exposes each
`*_support` name as a `window` global (number, boolean, or `{}` object
depending on flag type) — **228 distinct `*_support` globals** exist live on
this unit, far more than either static report enumerated by name.

### 2.1 Flags both reports named as universal-or-Merlin-relevant

| Flag | Live value | Notes |
|---|---:|---|
| `dnsfilter_support` | `2` | |
| `openvpnd_support` | `1` | |
| `nfsd_support` | `0` | **Off** — NFS Exports page exists (§7) but the feature itself is disabled on this unit. |
| `ipsec_srv_support` | `5` | |
| `vpn_fusion_support` | `1` | |
| `cake_support` | `1` | |
| `igd2_support` | `1` | |
| `ntpd_support` | `1` | |
| `pptpd_support` | `1` | |
| `v6option_support` | `0` | Present as a flag (per cross-gen report, Asus-native on this generation) but off. |
| `gu_support` | **absent from `window`** | Confirms the cross-gen report's suspicion: not a real flag on the 3006 branch at all, not just "off." |
| `mtlancfg_support` | `6` | SDN backing flag — see §5. |
| `gre_support` | `0` | |
| `agile_dfs_support` | `0` | |
| `app_action_support` | `{}` (present, empty object) | |
| `asus_support` | **absent from `window`** | No flag by this exact name exists. The nearest live match is `findasus_support` (`0`) — a "Find My Asus" flag, not the same thing. Treat `asus_support` as a report artifact, not a real flag. |
| `band6g_2_support` | **absent from `window`** | Not the same as `band6g_support` (`true`), which does exist — see §2.2. |
| `dashboard_support` | `0` | |
| `maxassoc_support` | `0` | |
| `mtk_support` | `0` | (this is a Broadcom-platform unit) |
| `mtppp_support` | `0` | |
| `no_zero_wait_dfs_support` | `0` | |
| `wbmenu_support` | `0` | |

### 2.2 Notable flags live that neither report's list named

Sampled from the full 228; these are the ones structurally relevant to
feature-detection or that explain something the static reports flagged as
uncertain:

| Flag | Live value | Why it matters |
|---|---:|---|
| `band6g_support` | `true` | Real, distinct from the absent `band6g_2_support` — 6GHz radio is present and active. |
| `wifi7_support` | `1` | Confirms Wi-Fi 7 hardware capability live, matches `mlo` in `rc_support`. |
| `traffic_analyzer_support` | `2` | Backs the Traffic Analyzer / bwdpi menu group. |
| `bwdpi_support` family (`bwdpi_support=2`, `bwdpi_mals_support=1`, `bwdpi_cc_support=1`, `bwdpi_vp_support=1`, `bwdpi_webFilter_support=1`, `bwdpi_webHistory_support=1`, `bwdpi_bwMonitor_support=1`) | mostly `1` | Deep-packet-inspection subsystem is fully enabled, not just nominally present. |
| `wireguard_support` | `1` | Backs the live WireGuard client seen active in §7. |
| `smart_connect_v2_support` | `1` | |
| `account_binding_support` | `2` | Asus account binding — present live despite AiCloud/OAuth being gone (§4); distinct subsystem. |
| `letsencrypt_support` | `1` | |
| `tor_support` | `1` | |
| `dhdlog_support` | `1` | |
| `findasus_support` | `0` | See §2.1 — the real name in place of the reports' assumed `asus_support`. |
| `adaptiveqos_support` | `1` | |
| `rrsut_support` | `0` | The RT-AX88U-only "router sync" flag the cross-gen report couldn't test — confirmed **off** here, consistent with it being absent from BE92U's `menuTree` gating list. |

### 2.3 Raw `rc_support` nvram string (live)

```
mssid 2.4G 5G update usbX1 switchctrl manual_stb 11AX pwrctrl nandflash movistarTriple wifi2017 app ofdma wpa3 reboot_schedule ipv6 ipv6pt PARENTAL2 dnsfilter am_addons cake ntpd dnspriv dualwan pptpd openvpnd utf8_ssid printer modem media appnet timemachine hdspindown diskutility igd2 dnssec usb_bk email 5G-2 bwdpi wrs_wbl dns_dpi ookla snmp tor HTTPS letsencrypt ssh vpnc vpn_fusion vpn_fusion_if repeater psta wl6 user_low_rssi tcode usericon cfg_wps_btn stainfo realip alexa ipsec_srv mumimo netool cfg_sync no_finiwl amas bcmwifi bcmhnd mbo conndiag eula proxysta iperf3 wifi7 mlo account_binding owe_trans wireguard nordvpn ftp_ssl acl96 dhdlog dis11b mtlancfg smart_connect_v2 wpa3-e wifi7 secure_default auto_wanport
```

This confirms `mtlancfg` (SDN) and `mlo` (Multi-Link Operation, Wi-Fi 7) are
both live-enabled tokens on this specific unit, matching the "Network" page
UI observed in §5.

---

## 3. Confirmed live menu source file (Task 2)

Read from the browser's actual network log on a fresh home-page load — not
inferred from `<script>` tags in the DOM.

**The live navigation file is `GET /require/modules/menuTree.js`.**

This matches the STOCK_VS_MERLIN_DIFF prediction exactly (the RT-BE92U side
of the cross-generation report's install-time rename-and-delete finding):
`www/Makefile` renames one `require/menuTrees/menuTree_*.js` variant to
`require/modules/menuTree.js` at build time and deletes the rest, so only one
file could ever be requested at runtime — but this session verified it by
capturing the actual browser request rather than trusting that inference. The
request returned `304 Not Modified` (browser cache), confirming it is a real,
repeated fetch, not a dead reference.

---

## 4. AiCloud resolution (Task 3)

All six pages were requested directly. **All six return `404 Not Found`.**

| Page | Result |
|---|---|
| `cloud_main.asp` | 404 Not Found |
| `cloud_sync.asp` | 404 Not Found |
| `cloud_settings.asp` | 404 Not Found |
| `cloud_status.asp` | 404 Not Found |
| `cloud_syslog.asp` | 404 Not Found |
| `cloud_router_sync.asp` | 404 Not Found |

**Contradiction resolved.** Merlin's changelog claim that AiCloud was removed
in 3006.102.7 is accurate at runtime, despite the `.asp` files still being
present in the `www/` source tree (as both static reports found). The
removal mechanism is not `www/Makefile` page exclusion (both reports already
established the Makefile gating is byte-identical to stock's) — it must
happen at the httpd routing-table level (the `ej_handlers[]`/`mime_handlers[]`
entries for these pages, or an explicit URL block) rather than by omitting
the file from the filesystem. This session did not go further to identify
the exact httpd mechanism (that would require reading `httpd/web.c` routing
logic, not live probing) — the runtime behavior itself is now fully settled
though: **source presence, zero runtime surface.**

---

## 5. SDN / Guest Network Pro findings (Task 4)

**Confirmed present and exposed in live navigation.** The left-nav "Network"
entry (linking to `SDN.asp`) is visible and reachable; it was not assumed —
found via an in-page element search, then navigated to directly.

Screenshot was taken only after confirming the working tab was the
foreground/selected tab (a second, blank tab from this session was closed
first — the docs' warning about backgrounded-tab screenshots was a real risk
here, since the tab tracker initially reported a *different* tab as selected).

The rendered page (`SDN.asp`) shows:

- **Main Network** section — the router's primary SSID family, with per-band
  icons (2.4/5/6 GHz) and a live connected-client count.
- **Guest Network** section — at least one additional SSID with its own
  per-band icons, an enable/disable toggle, and (for one network) a VLAN tag,
  confirming VLAN-backed guest network segmentation is active, not just
  configured-but-idle.
- **Smart Home Master** presets — "Kid's Network," "IoT Network," "VPN
  Network," and "Multi-Link Operation (MLO)" — each an "Add a Network"
  shortcut, i.e. templated SDN profiles, not just a bare SDN rule editor.

Backing nvram-family fields observed being fetched for this page (via
`appGet.cgi?hook=nvram_char_to_ascii(...)` calls in the network log, not by
reading values out of a form): `sdn_rl`, `subnet_rl`, `apg1_ssid`,
`apg2_ssid`, `apm1_ssid`, `apm2_ssid`, `apm1_security`, `apg1_disabled`,
`apg2_disabled` — matching the `sdn_*`/`apg_*` nvram families both static
reports predicted from source alone. `mtlancfg_support` reads `6` live (§2.1).

**No control was clicked** — no "Add a Network," no toggle, no save. Purely
observational, per the session constraint.

---

## 6. Read-path auth verification result (Task 5)

Executed as a JavaScript `fetch()` inside the authenticated page's own
context (same-origin, existing session cookie, **GET only**):

```js
const r = await fetch('/update_clients.asp', {method:'GET', credentials:'same-origin'});
```

**Result: `200 OK`, `ok: true`, `content-type: text/html`, response body
101,394 bytes.**

This confirms the read path works exactly as the STOCK_VS_MERLIN_DIFF report
hoped to verify: a representative read-only data endpoint, hit with a plain
authenticated GET from the page's own JS context, succeeds and returns a
substantial payload using the existing session — with no indication that
Merlin's 1517-line `web.c` diff (login/captcha/security-log/`action_mode`
changes) interferes with this class of request. The response body itself is
not reproduced here (it contains live client MAC/hostname data). **The write
path was intentionally not exercised or characterized**, per the no-mutation
constraint for this session — that remains open for a future session that is
explicitly scoped to allow it.

---

## 7. Page sweep results (Task 6)

34 pages visited (representative sample per the task's own scope — not
exhaustive). For each: navigated, waited for load, checked browser console
for errors, confirmed non-404 status via title/content. A short pause was
inserted between navigations throughout, not just during this task, given
this is a real embedded httpd serving live traffic.

### 7.1 Clean — renders, no console errors, matches source-tree expectation

**Merlin-exclusive pages (all render correctly):**
`Advanced_VPNDirector.asp`, `Advanced_VPNStatus.asp`,
`Advanced_OpenVPNClient_Content.asp`, `DNSDirector.asp`, `Tools_Sysinfo.asp`,
`Tools_OtherSettings.asp`, `Main_TrafficMonitor_monthly.asp`,
`Main_TrafficMonitor_settings.asp`, `QoS_Stats.asp`,
`Advanced_AiDisk_NFS.asp`, `Main_Security_Change_Notification.asp`,
`Advanced_Wireless_Survey.asp` (SITE_SURVEY), `Main_Analysis_Content.asp`
(model overlay), `Main_Netstat_Content.asp` (model overlay).

**Shared/runtime-relevant page:** `Advanced_VPN_OpenVPN.asp` — confirmed
**present and rendering** on this Merlin unit (as "VPN Server"), consistent
with both reports' finding that stock deletes this page at install while
Merlin keeps it.

**Universal-baseline pages (all render correctly):** `index.asp` (home),
`device-map/router_status.asp`, `Advanced_System_Content.asp`,
`Advanced_WAN_Content.asp`, `Advanced_LAN_Content.asp`,
`Advanced_DHCP_Content.asp`, `Advanced_Firewall_Content.asp`,
`Advanced_FirmwareUpgrade_Content.asp`, `Advanced_SettingBackup_Content.asp`,
`Main_DHCPStatus_Content.asp`, `Main_LogStatus_Content.asp`,
`Main_ConnStatus_Content.asp`, `Main_TrafficMonitor_realtime.asp`,
`Main_TrafficMonitor_daily.asp`, `Main_TrafficMonitor_last24.asp`,
`QoS_EZQoS.asp`, `Advanced_VPNClient_Content.asp`,
`Advanced_WireguardClient_Content.asp`.

**Special `.htm` pages:** `message.htm` loads statically ("Detecting AiMesh
router...") with no console error when hit without its normal query
parameters — expected behavior for a JS-driven page missing its usual
context, not a failure.

### 7.2 Source-present-but-not-served (called out specifically, per task)

| Page(s) | Source presence | Runtime result |
|---|---|---|
| `cloud_main.asp`, `cloud_sync.asp`, `cloud_settings.asp`, `cloud_status.asp`, `cloud_syslog.asp`, `cloud_router_sync.asp` | Present in `www/` per both static reports | **404 Not Found**, all six (§4) |

No other page from either report's lists 404'd during this sweep. The
AiCloud six remain the only confirmed source-present/runtime-absent case.

### 7.3 Anomaly found (not visible from static source alone)

**`Advanced_WAdvanced_Content.asp`** (the RT-BE92U model-overlay "Professional"
wireless page) **renders its full content correctly** — every expected
control (band selector, roaming assistant, OFDMA/MU-MIMO, TX power, etc.) is
present — **but throws one uncaught JavaScript exception per load**,
originating in `require.min.js`'s `onScriptError` handler:

```
[EXCEPTION] (http://192.168.1.1/require/require.min.js:11:136)
Uncaught
  at ca (require.min.js:11:136)
  at w (require.min.js:15:296)
  at onScriptError (require.min.js:32:511)
```

All of this page's `require/modules/*.js` dependencies (`amesh.js`,
`makeRequest.js`, `diskList.js`, `menuTree.js`) loaded with `200`/`304` — no
missing file. The error is reproducible (fired again on a second, isolated
reload) and does not appear to break the page's functionality, but it is a
genuine client-side error on a Merlin-modified model-overlay page that
neither static report could have surfaced, since it only manifests at
runtime. Root cause not investigated further (would require reading the
page's inline script or `require.min.js` internals).

### 7.4 Skipped

- `start_apply.htm` — blocked by this session's own safety layer before any
  request was sent (see Summary). Not a router-observed result.
- The full `ajax_*.asp` data-feed pages (`ajax_vpn_status.asp`,
  `ajax_sysinfo.asp`, `ajax_wificlients.asp`, `ajax_gettcdata.asp`,
  `ajax_conntrack.asp`) were not individually swept as standalone
  navigations — they were observed firing successfully (200) as background
  requests from the pages that consume them (e.g. `Tools_Sysinfo.asp`,
  `QoS_Stats.asp`) during the sweep above, which is a stronger signal than a
  bare direct hit would have given anyway.

---

## 8. Remaining open unknowns

1. **Exact AiCloud removal mechanism.** Confirmed to 404 at runtime (§4), but
   *how* — httpd routing table exclusion vs. an explicit deny — was not
   determined. Would require reading `httpd/web.c` rather than live probing.
2. **`Advanced_WAdvanced_Content.asp` console exception root cause** (§7.3).
   Reproducible, non-fatal, but unexplained.
3. **Write-path auth behavior remains entirely untested**, by design (§6).
   Merlin's `web.c` diff (captcha, security logging, new `action_mode`
   values) is verified not to break the read path; nothing here speaks to
   `do_auth`/CSRF/session behavior under a state-changing request.
4. **The 38962→39848 stock/Merlin attribution gap** from the original report
   is unaffected by this session — live probing confirms runtime behavior,
   not source provenance.
5. **`start_apply.htm` behavior is unverified** — session-level safety
   blocking, not a router finding. A future session explicitly scoped to
   observe (not submit) that flow could revisit it.

---

*Generated from a live, read-only browser session against the operator's
RT-BE92U at `192.168.1.1`, 2026-07-24. GET requests only; no settings
changed, no controls submitted, no reboot/upgrade triggered. Uncommitted, as
instructed.*
