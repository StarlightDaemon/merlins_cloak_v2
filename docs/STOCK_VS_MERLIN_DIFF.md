# Stock Asuswrt vs Asuswrt-Merlin — RT-BE92U Web UI Structural Comparison

Static source comparison only. No live router was contacted at any point during
this analysis.

---

## 1. Summary

| | Stock (Asus) | Merlin |
|---|---|---|
| Artifact | `GPL_RT_BE92U_300610238962.zip` → `GPL_RT-BE92U_3.0.0.6.102.38962-gd4b936e_1425-g5f426_BB0B.tgz` | `RMerl/asuswrt-merlin.ng` tag `3006.102.7_2` |
| Version label | `3.0.0.6.102_38962` (listed by Asus as `30.0.6.102_38962`) | `3006.102.7_2`, commit `542f71114524e009773c124a89f438d53be1c6f5`, 2026-03-24 |
| Underlying Asus GPL base | 102_38962 (this *is* the Asus drop) | **102_39848** (per `Changelog-3006.txt`: "Merged GPL 102_39848 (RT-BE92U only)") |

**Router in use: Merlin 3006.102.7_2 — exact tag match, zero version gap on the Merlin side.**

**Version gap on the stock side: ~1 GPL drop (38962 → 39848).**

The router's Merlin build is derived from Asus GPL **102_39848**, which Asus has
**not published**. The newest GPL archive Asus offers for the RT-BE92U is
**102_38962** (archive dated 2025-09-10), and the newest *firmware image* is
102_39063 (2026-05-07) — also newer than the newest published GPL. So the stock
baseline used here trails the Merlin baseline by one Asus maintenance cycle.

**Consequence for reading this report:** a difference found on a shared page is
*either* a Merlin change *or* an Asus change made between 38962 and 39848. Where
the distinction matters it is called out. The clearest example: several new
`.cgi` endpoints appear "Merlin-only" in the httpd tables
(`getDpiInfo.cgi`, `delDpiInfo.cgi`, `upgrade_aisom.cgi`,
`get_aisom_upgrade_info.cgi`, `esr_get_history.cgi`, `get_afc_info_json.cgi`)
but are plainly Asus-authored features inherited from the newer GPL, not Merlin
additions.

### Headline counts

| Metric | Value |
|---|---|
| `www/` files present in both (excl. `sysdep/`) | 1228 |
| — byte-identical | 971 |
| — differing | 257 (of which 71 are `.asp`) |
| Top-level pages (`*.asp`/`*.html`) in stock | 239 |
| Top-level pages in Merlin | 255 |
| — shared | 238 |
| — stock-only | 1 |
| — Merlin-only | 17 |
| Merlin-only files overall (excl. `sysdep/`) | 32 |
| Stock-only files overall (excl. `sysdep/`) | 6 |
| Merlin-only `sysdep/` pages | 6 |
| httpd `ej_handlers[]` entries — stock / Merlin | 350 / 368 (**18 Merlin-only, 0 stock-only**) |
| httpd `mime_handlers[]` entries — stock / Merlin | 342 / 356 (**14 Merlin-only, 0 stock-only**) |
| nvram keys referenced in `www/` — stock / Merlin | 1408 / 1329 (131 Merlin-only, 210 stock-only) |

The single most useful structural fact for feature detection:
**Merlin's httpd routing tables are a strict superset of stock's.** Not one
`ej_handler` or `mime_handler` present in stock is absent from Merlin. Endpoint
behaviour for shared pages is therefore additive, not divergent.

---

## 2. Provenance

| Source | Obtained | Where / how | Status |
|---|---|---|---|
| Asus GPL source archive | **Yes** | asus.com support downloads, product `RT-BE92U` (`pdid=26953`, `pdhashedid=vagk41cicytg2ndt`), OS filter **"Others"** (`osid=8`) → category "Source Code". Direct URL: `https://dlcdnets.asus.com/pub/ASUS/wireless/RT-BE92U/GPL_RT_BE92U_300610238962.zip` | **Verified** — 1,056,192,686 bytes, `sha256 3d8040f4fca9013f63c46210d3d6847a67c8342a7d789244962a07a9bf825fc9`. Saved to `RAW/stock/`. Three GPL versions are published: 38962, 37526, 37435. |
| Firmware image extraction (fallback) | **Not needed** | The GPL path succeeded, so the documented fallback (download `.trx`, unpack squashfs with binwalk/unsquashfs) was **not exercised**. No extraction tooling was installed. | **Not applicable** |
| Merlin clone | **Yes** | `git clone --depth 1 --branch 3006.102.7_2 https://github.com/RMerl/asuswrt-merlin.ng.git` into `RAW/merlin/` | **Verified** — exact tag, commit `542f711…`, `git describe` = `3006.102.7_2` |

### Acquisition notes (deviations worth recording)

- **Asus's support page is fully JS-rendered**; the GPL archive is not
  discoverable from the page HTML. The download list is served by
  `https://www.asus.com/support/webapi/ProductV2/GetPDDrivers`, and GPL source
  only appears under the **"Others"** OS filter (`osid=8`). Only the Global
  region page was needed — no second region was required, because the Global
  page yielded the archive.
- **`dlcdn.asus.com` does not resolve.** The live CDN host is
  **`dlcdnets.asus.com`**. Guessed archive filenames all 404; only the API-supplied
  path works.
- **Merlin's worktree cannot be checked out on Windows as-is.** The bundled
  Linux 4.1 kernel tree contains
  `release/src-rt-5.02L.07p2axhnd/kernel/linux-4.1/drivers/gpu/drm/nouveau/nvkm/subdev/i2c/aux.c`,
  and `AUX` is a reserved Win32 device name, so `git checkout` aborts with
  `invalid path` and leaves an empty worktree. Worked around with
  `git -c core.protectNTFS=false archive HEAD <paths> | tar -x`, materialising only
  `release/src/router/{www,httpd,shared}` plus `Changelog-3006.txt`. **The Merlin
  clone in `RAW/merlin/` is therefore a partial worktree over a complete `.git`** —
  any other path can be materialised the same way.
- **CRLF hazard.** The first extraction used git's default `core.autocrlf`, which
  appended CR to files that already had CRLF, making 839 of 1228 shared files
  appear to differ. The tree was re-extracted with
  `-c core.autocrlf=false -c core.eol=lf`, after which the real figure is 257.
  Anyone re-running this comparison must disable autocrlf or every diff is noise.
- The GPL tarball was streamed and filtered rather than fully unpacked: the full
  217,710-entry file manifest is at `RAW/stock/stock_manifest.txt`, and the 5,110
  files under any `www/`, `httpd/`, or `shared/` directory were extracted to
  `RAW/stock/extracted/`. No Windows-illegal paths were hit in that subset
  (0 skipped). Nothing was flashed, mounted, or executed.
- Working comparison lists are in `RAW/compare/`.

---

## 3. Page inventory

`www` root for both sources is `release/src/router/www/`. Directory structure is
identical (`aidisk aimesh ajax calendar css dashboard datatables device-map fonts
images js jscolor notification_center require svghtc switcherplugin sysdep userRpm`).

### 3.1 Stock-only pages

| Page | Stock | Merlin | Notes |
|---|:-:|:-:|---|
| `DNSFilter.asp` | ✅ | ❌ | **The only stock-only page.** Merlin deletes it and ships `DNSDirector.asp` in its place; the stock entry is commented out in Merlin's `menuTree.js`. Superset of stock's per-client DNS filtering. |

Also stock-only, non-page assets: `dashboard/images/favicon.png`,
`images/New_ui/icon_SMS.png`, `images/checked.gif`,
`images/logo_GearUp_console@1x.png`, `images/speedtest/linkspeed_dark.png`.

### 3.2 Merlin-only pages

| Page | Stock | Merlin | Notes |
|---|:-:|:-:|---|
| `Advanced_VPNDirector.asp` | ❌ | ✅ | Policy routing for VPN clients; `vpndirector_rulelist` |
| `Advanced_VPNStatus.asp` | ❌ | ✅ | Unified OpenVPN/WireGuard status |
| `Advanced_OpenVPNClient_Content.asp` | ❌ | ✅ | Merlin's OpenVPN client UI, parallel to Asus's `Advanced_VPNClient_Content.asp` (which Merlin also keeps) |
| `ajax_vpn_status.asp` | ❌ | ✅ | Polling endpoint for the above |
| `DNSDirector.asp` | ❌ | ✅ | Replaces `DNSFilter.asp` |
| `UploadingJFFS.asp` | ❌ | ✅ | JFFS partition backup/restore progress |
| `Tools_Sysinfo.asp` | ❌ | ✅ | System info (mem, CPU, temps, wireless) |
| `ajax_sysinfo.asp` | ❌ | ✅ | Data feed for `Tools_Sysinfo.asp` |
| `ajax_wificlients.asp` | ❌ | ✅ | Wireless client list feed |
| `Tools_OtherSettings.asp` | ❌ | ✅ | "Tweaks" — exposes ~25 nvram knobs with no stock UI |
| `Main_TrafficMonitor_monthly.asp` | ❌ | ✅ | rstats monthly view |
| `Main_TrafficMonitor_settings.asp` | ❌ | ✅ | rstats storage/interval config |
| `ajax_gettcdata.asp` | ❌ | ✅ | tc/QoS class data feed |
| `ajax_conntrack.asp` | ❌ | ✅ | Conntrack table feed |
| `QoS_Stats.asp` | ❌ | ✅ | Per-class QoS statistics |
| `Advanced_AiDisk_NFS.asp` | ❌ | ✅ | NFS exports (`nfsd_enable`, `nfsd_exportlist`) |
| `Main_Security_Change_Notification.asp` | ❌ | ✅ | Security-update notification settings |
| `sysdep/FUNCTION/SITE_SURVEY/Advanced_Wireless_Survey.asp` | ❌ | ✅ | Site Survey; whole `SITE_SURVEY` FUNCTION dir is Merlin-only, installed for `HND_ROUTER=y` (RT-BE92U qualifies). Had a security fix in 3006.102.7_2. |
| `sysdep/FUNCTION/ROG_UI/Main_TrafficMonitor_{daily,monthly}.asp` | ❌ | ✅ | ROG-skin variants of the traffic monitor |

Merlin-only supporting assets: `js/trafmon.js`, `js/chart.min.js`,
`js/chartjs-plugin-zoom.min.js`, `js/hammer.min.js`, `base64.js`,
`images/merlin-logo.png`, `ajax/ouiDB.json`, `ajax/logFilter.json`,
`ajax/extend_custom_icon.json`, `fonts/ROG_Fonts-Regular.{otf,woff}`,
`images/New_ui/light_effect/light_effect_mask{,_rog}_UI4.png`.

### 3.3 RT-BE92U model overlay (`sysdep/RT-BE92U/www/`)

| File | Stock | Merlin | Notes |
|---|:-:|:-:|---|
| `images/*` (model art, port maps) | ✅ | ✅ | Merlin adds `btnPressed.png`/`btnReleased.png` |
| `Advanced_WAdvanced_Content.asp` | ❌ | ✅ | Model-specific override of the shared professional-wireless page |
| `Main_Analysis_Content.asp` | ❌ | ✅ | Network Tools → Analysis |
| `Main_Netstat_Content.asp` | ❌ | ✅ | Network Tools → Netstat |

Stock ships **no** `.asp` overlay for this model — only images. Anything the
extension keys off these three pages is Merlin-only on this hardware.

### 3.4 Shared pages with genuine structural divergence

971 of 1228 shared files are byte-identical. The 71 differing `.asp` pages,
ranked by changed lines, with the divergence that actually matters:

| Page | Δ lines | Structural divergence |
|---|---:|---|
| `Advanced_VPN_OpenVPN.asp` | 1359 | Effectively a Merlin rewrite. **Stock's `www/Makefile` deletes this page at install time; Merlin's does not** — so it is "shared in source, stock-absent at runtime". Adds `vpn_server_ncp_ciphers`, `vpn_server_pdns`, `vpn_server_verb`, `vpn_serverx_start`, `vpn_server{1,2}_port`. |
| `Main_TrafficMonitor_last24.asp` | 684 | rstats-backed rewrite (stock uses its own collector) |
| `Advanced_WireguardClient_Content.asp` | 592 | Merlin adds `wgc*_desc/enable/ep_addr/ep_port/rip`, `wgc_enforce`, `wgc_mtu`; adds `stop_wgc` action_script |
| `Main_TrafficMonitor_realtime.asp` | 560 | rstats rewrite |
| `Main_ConnStatus_Content.asp` | 528 | Conntrack/IP-traffic tables via Merlin `ej` handlers |
| `Advanced_System_Content.asp` | 481 | Adds `ntpd_enable`, `ntpd_server_redir`, `ntp_server1`, `sshd_forwarding`, `https_crt_gen`, `httpd_cert_info()`; changes the apply `action_script` from `restart_time;restart_upnp;` to `restart_time;restart_leds;` |
| `Main_TrafficMonitor_daily.asp` | 473 | rstats rewrite |
| `Main_WStatus_Content.asp` | 389 | Extended wireless status (`get_wl_status`, `wl_extent_channel`) |
| `QoS_EZQoS.asp` | 230 | Adds Cake/FlowQoS options: `qos_atm`, `qos_default`, `qos_mpu`, `qos_overhead` |
| `Advanced_WAN_Content.asp` | 189 | Adds `wan_route_x`, `ddns_refresh_x`-adjacent handling |
| `Main_IPV6Status_Content.asp` | 178 | `get_ipv6clients_array` / `get_ipv6net_array` |
| `Advanced_FirmwareUpgrade_Content.asp` | 152 | **Merlin comments out the Asus download/FAQ links and the auto-upgrade path** (`document.start_update.action_script.value="stop_upgrade;start_webs_upgrade"` is commented out); version string is reformatted |
| `Advanced_VPN_PPTP.asp` | 150 | Merlin splits PPTP out of the combined VPN menu gate |
| `device-map/router_status.asp` | 142 | Adds live rx/tx bars driven by `qos_enable`/`qos_ibw`/`qos_obw` |
| `Main_DHCPStatus_Content.asp` | 135 | `get_leases_array` |
| `Main_IPTStatus_Content.asp` | 106 | `iptmon` / `iptraffic` / `ipt_bandwidth` |
| `Advanced_ASUSDDNS_Content.asp` | 103 | Custom DDNS providers, `ddns_refresh_x` |
| `Main_RouteStatus_Content.asp` | 94 | `get_route_array` |
| `Advanced_SettingBackup_Content.asp` | 72 | JFFS backup/restore (`backup_jffs*.tar`, `jffsupload.cgi`) |
| `Main_Login.asp` | 55 | Gates the Asus domain-redirect script behind `http_dut_redir` |
| `Advanced_Firewall_Content.asp` | 38 | `ipv6_pinholes` |
| `index.asp` | 38 | Merlin branding + menu wiring |
| `require/menuTrees/menuTree{,_ROG}.js` | 68/71 | **The navigation contract.** Adds `menu_Sysinfo` group; adds VPN Status / VPN Director / OpenVPN tabs; swaps DNSFilter → DNS Director; adds NFS Exports, Tweaks, Site Survey, Security Update Notification, QoS Classification, TrafficMonitor monthly/settings; splits the VPN visibility gate from one combined `menu_VPN` check into per-protocol checks (`pptpd_support`, `openvpnd_support`, `ipsec_srv_support`, `nfsd_support`) |
| `state.js` | 165 | Feature-support flag definitions — the primary feature-detection surface |
| `js/Chart.js`, `chart.js` | 3562 / 3592 | Charting library version bump |

Also structurally relevant, from the `www/Makefile` diff:

- Merlin **deletes** `Advanced_Feedback.asp` at install; stock ships it.
- Stock **deletes** `Advanced_VPN_OpenVPN.asp` at install; Merlin ships it.
- Merlin copies `sysdep/FUNCTION/SITE_SURVEY/*` into `www/` when `HND_ROUTER=y`.
- Merlin keeps `js/qrcode` (stock removes it); adds `client{1,2}.ovpn` symlinks
  for two OpenVPN servers where stock links only one.
- Both gate AiCloud assets identically on `RTCONFIG_CLOUDSYNC`. Merlin's
  changelog states AiCloud was removed in 3006.102.7, but the `cloud_*.asp`
  sources are still present in the tree — removal happens outside `www/`.
  **Do not infer AiCloud availability from page presence.**

---

## 4. Merlin-exclusive feature groups

131 nvram keys are referenced in Merlin's `www/` and not in stock's, grouped by
feature area.

### VPN — OpenVPN / WireGuard / VPN Director
Pages: `Advanced_VPNDirector.asp`, `Advanced_VPNStatus.asp`,
`Advanced_OpenVPNClient_Content.asp`, `ajax_vpn_status.asp`,
`Advanced_VPN_OpenVPN.asp` (runtime-exclusive)

- `vpn_client{1..5}_{desc,enforce,rgw,rip,state}`
- `vpn_client_{addr,adns,cipher,cn,comp,connretry,desc,digest,enforce,gw,hmac,if,local,ncp_ciphers,nm,port,remote,reneg,rgw,rip,tlsremote,verb}`
- `vpn_server{1,2}_port`, `vpn_server2_errno`, `vpn_server_{ncp_ciphers,pdns,verb}`, `vpn_serverx_start`
- `vpndirector_rulelist`, `vpnc_defroute_x`, `vpnc_dnsenable_x`
- `wgc{1..5}_{desc,enable,ep_addr,ep_port,rip}`, `wgc_{desc,enforce,mtu}`
- action_scripts: `start_vpnclient`, `stop_vpnclient`, `restart_vpnclient`, `restart_vpnserver`, `restart_chpass;restart_vpnserver`, `stop_wgc`, `restart_pptpd`, `stop_pptpd`

### DNS Director
Page: `DNSDirector.asp` (replaces stock `DNSFilter.asp`)

- `dnsfilter_rulelist`, `dnsfilter_rulelist{1..5}`, `dnsfilter_custom6{1,2,3}`
- action_script: `restart_dnsmasq`

### JFFS / addons / custom scripts
Pages: `UploadingJFFS.asp`, `Advanced_SettingBackup_Content.asp` (extended)

- `jffs2_on`, `jffs2_scripts`
- mime handlers: `backup_jffs*.tar`, `jffsupload.cgi*`
- `ej` handler: `get_custom_settings`

### Traffic monitoring & QoS statistics
Pages: `Main_TrafficMonitor_{monthly,settings}.asp`, `QoS_Stats.asp`,
`ajax_gettcdata.asp`, `ajax_conntrack.asp`; assets `js/trafmon.js`,
`js/chart.min.js`, `js/chartjs-plugin-zoom.min.js`, `js/hammer.min.js`

- `rstats_path`, `rstats_stime`
- `qos_atm`, `qos_default`, `qos_mpu`, `qos_overhead`
- `ct_max`, `ct_tcp_timeout`, `ct_udp_timeout`
- `ej` handlers: `iptmon`, `iptraffic`, `ipt_bandwidth`, `get_tcclass_array`, `get_tcfilter_array`, `bwdpi_conntrack`, `get_connlist_array`
- httpd sources: `data_arrays.{c,h}`, `iptraffic.h`

### System info & diagnostics
Pages: `Tools_Sysinfo.asp`, `ajax_sysinfo.asp`, `ajax_wificlients.asp`,
`sysdep/RT-BE92U/www/{Main_Analysis,Main_Netstat,Advanced_WAdvanced}_Content.asp`,
`sysdep/FUNCTION/SITE_SURVEY/Advanced_Wireless_Survey.asp`

- `buildinfo`, `CUSTOM`, `stub`
- `ej` handlers: `asus_sysinfo`, `get_wl_status`, `wl_extent_channel`
- httpd sources: `sysinfo.{c,h}`
- action_script: `restart_wlcscan`

### Logging
Pages: `Main_LogStatus_Content.asp`, `Main_IPTStatus_Content.asp`,
`Main_ConnStatus_Content.asp` (all shared but extended)

- `log_level`, `message_loglevel`, `dhcpd_querylog`
- httpd: Merlin adds `security2log()` / `SECURITY_LOG` in `httpd.c` and emits it
  on login success/failure and captcha error — stock logs to `logmessage` only.
  Merlin also changes the login log wording (`success`/`fail` → `successed`/`failed`),
  which will break any log parser keyed on the stock strings.

### NFS
Page: `Advanced_AiDisk_NFS.asp`

- `nfsd_enable`, `nfsd_exportlist`

### Tweaks / miscellaneous services (`Tools_OtherSettings.asp`)
- NTP: `ntpd_enable`, `ntpd_server_redir`, `ntp_server1`
- UPnP: `upnp_{min,max}_port_{int,ext}`, `upnp_pinhole_enable`
- LAN/WAN: `lan_stp`, `wan_route_x`, `ipv6_dhcp6c_release`
- HTTP/HTTPS: `http_dut_redir`, `https_crt_gen`
- SMB/SSH: `smbd_protocol`, `sshd_forwarding`, `telenet`
- USB: `usb_idle_exclude`
- Updates/DDNS: `firmware_check_enable`, `ddns_refresh_x`
- `ej` handlers: `ipv6_pinholes`, `get_ipv6clients_array`, `get_ipv6net_array`, `get_leases_array`, `get_route_array`, `get_upnp_array`, `get_vserver_array`
- action_scripts: `restart_ftpd`

### Security update notification
Page: `Main_Security_Change_Notification.asp`

---

## 5. Stock-exclusive elements

Genuinely few, and mostly *removals* rather than divergence.

1. **`DNSFilter.asp`** — the only stock-only page. Replaced by `DNSDirector.asp`.
2. **`Advanced_Feedback.asp`** — present in both trees, but Merlin's
   `www/Makefile` deletes it at install. Effectively stock-only at runtime.
3. **Five stock-only image assets** (favicon, SMS icon, `checked.gif`,
   GearUp console logo, dark speedtest linkspeed graphic).
4. **Zero stock-only httpd handlers.** Both `ej_handlers[]` and `mime_handlers[]`
   are strict supersets in Merlin.
5. **210 nvram keys appear only in stock's `www/`, but almost none apply to this
   hardware.** The overwhelming majority are other-product-family fields carried
   in the shared Asuswrt tree:
   - DSL/xDSL: `dsl_*`, `dsllog_*`, `dslx_*`, `dsltmp_*` (~110 keys) — DSL-AC models
   - LTE/3G modem: `modem_*`, `usb_modem_act_*`, `g3state_pin`, `lte_update_status` (~35 keys) — 4G-AC models
   - Non-Broadcom radio: `qca_gro`, `wl0_vifnames`, `wsc_config_*`
   - Asus IPSec/PMS: `ipsec_ca_{1..5}`, `ipsec_client_list_{1..5}`, `ipsec_profile_{1..5}_ext`, `ipsec_hw_crypto_enable`, `ipsec_log_level`, `radius_serv_list`, `PM_MY_NAME`, `PM_SMTP_AUTH_PASS`
   - Asus's own OpenVPN server keys that Merlin replaced with its own scheme:
     `vpn_server_{firewall,if,poll,proto,reneg}`, `vpn_serverx_{dns,eas}`, `vpn_crt_server1_static`
   - Switch rate control: `switch_ctrlrate_*`
   - Stock-only action_scripts: `restart_vpnd`, `stop_vpnd`, `restart_openvpnd;restart_chpass`, `stop_openvpnd`, `restart_dsl_setting;`, `overwrite_captive_portal_ssid;restart_wireless;`, `overwrite_fbwifi_ssid;`, `restart_pms_account;restart_radiusd`, `restart_pms_device;`, `saveNvram;reboot`

   The residual set that could matter on an RT-BE92U is small: `sshd_authkeys`,
   `wandog_delay`, `lan_hash_algorithm`, `lan_ipaddr_t`, and the legacy
   `vpn_server*` names. Treat these as "stock naming, check before use" rather
   than "stock-only feature".

---

## 6. Open unknowns — require live-router verification

1. **Source presence ≠ served page.** Both `www/` trees carry pages for every
   model in the family. What actually lands in `/www` on an RT-BE92U is decided
   by `www/Makefile` conditionals (`RTCONFIG_*`, `HND_ROUTER`) that cannot be
   evaluated without the model's build config. **Every "present in both" row in
   §3 is a source-tree fact, not a runtime guarantee.**
2. **AiCloud.** Merlin's changelog says AiCloud was removed in 3006.102.7, yet
   `cloud_main.asp`, `cloud_sync.asp`, `cloud_settings.asp`, `cloud_status.asp`,
   `cloud_syslog.asp`, `cloud_router_sync.asp` are all still in Merlin's `www/`
   and the `www/Makefile` gating is identical to stock's. Whether these pages
   resolve, 404, or redirect on the running unit is unresolved.
3. **The 38962 → 39848 attribution gap.** Differences on shared pages cannot be
   cleanly attributed to Merlin vs Asus without the 39848 GPL drop, which Asus
   has not published. The six `.cgi` endpoints named in §1 are the identified
   cases; there may be others among the 257 differing files.
4. **`state.js` feature flags.** The 165-line diff defines the support flags
   (`dnsfilter_support`, `openvpnd_support`, `nfsd_support`, `ipsec_srv_support`,
   `vpn_fusion_support`, …) that `menuTree.js` gates on. Their *values* on this
   specific unit come from nvram/`rc_support` at runtime and cannot be read
   statically. **This is the correct feature-detection surface, but it must be
   sampled live.**
5. **httpd auth semantics.** Merlin's `web.c` differs by 1517 lines including
   login/captcha/security-log paths and new `action_mode` values
   (`refresh_vpn_ip`, `refresh_wgc_ip`, `reset_vpn_ip`). Whether session token
   handling, CSRF checks, or `do_auth` behaviour differ in ways that affect an
   extension's request flow was not established — the diff is large enough that a
   line-level audit, or live probing, is warranted before relying on it.
6. **Content-type change on two shared endpoints.** Merlin serves
   `wcdma_list.js` and `help_content.js` as `text/javascript`; stock serves them
   as `text/html`. Any client that branches on content-type will see a
   difference. Unverified whether this originates in Merlin or in GPL 39848.
7. **`model_patch` is not model-specific for RT-BE92U** — it contains no BE92U
   entry, so no patchlets apply. Whether any other build-time transform touches
   this model's pages is unresolved.
8. **The Merlin worktree in `RAW/merlin/` is partial** (`www`, `httpd`, `shared`
   only). Comparisons involving `rc/`, `shared/defaults.c` nvram default tables,
   or `libbcm`/`bwdpi` were not performed.

---

*Generated from static source comparison, 2026-07-24. No live router contacted.*
