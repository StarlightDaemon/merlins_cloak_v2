# Current State Audit — 2026-07-25

Fresh-verification pass, independent of STATUS.md's own claims. Each section
states what was actually re-checked and how, not what was previously asserted.

## HEADLINE — read this before running the next-session taxonomy proposal

**PENDING — see final update at the end of this section once Tasks 2–4 complete.**
Preliminary check (below, Task 1) re-derived the view/category counts directly
from `src/pages/defs/*` source rather than trusting STATUS.md's summary table,
and they matched exactly: **73 views (50 settings + 23 custom), 67 distinct
native .asp pages, 14 Merlin-only views, 18 nav categories**. No discrepancy
found yet that would change the taxonomy proposal's premise. This line will be
updated (or left as final) after the full per-view inventory and the Firefox
check are done.

---

## Task 1 — Git and build state (2026-07-25, fresh)

### Git

- `git log --oneline`: HEAD is `dd1dc13` "STATUS: record Chrome
  live-verification results and findings" — matches what STATUS.md's own
  changelog implies (it describes itself as the record of the session ending
  at that commit).
- `git status`: **working tree clean**, nothing staged or unstaged.
- Branch is **ahead of `origin/main` by 11 commits** (i.e. nothing has been
  pushed yet this project). Not a discrepancy against STATUS.md — STATUS.md
  never claims anything about push state — but worth flagging since it means
  all work so far is local-only.
- No discrepancy found between committed state and STATUS.md's claims about
  what commit the document reflects.

### Build (both re-run fresh this session, `.output/` deleted first)

| Check | Command | Result |
|---|---|---|
| Lint | `npm run lint` | **PASS** — clean, no output |
| Typecheck | `npm run compile` (`tsc --noEmit`) | **PASS** — clean, no output |
| Chrome build | `npm run build` (`wxt build`, chrome-mv3) | **PASS** — built in 498ms, 632.42 kB total, all expected artifacts present (manifest.json, background.js, content-scripts/content.js, popup bundle, icons) |
| Firefox build | `npm run build:firefox` (`wxt build -b firefox --mv3`) | **PASS** — built in 510ms, 632.55 kB total, same artifact set under `firefox-mv3` |

STATUS.md's claim "Lint clean; Chrome (MV3) and Firefox builds both pass" is
**confirmed accurate** as of this session — not stale. Note the Firefox
target actually built is `firefox-mv3` (via `-b firefox --mv3`), not MV2;
STATUS.md's open-items list says "`.output/firefox-mv2 or -mv3`" — the
project only has an MV3 Firefox build script (`build:firefox`), no MV2 script
exists in package.json. This is a documentation-precision nit, not a
functional discrepancy: only one Firefox target exists and it builds.

### Summary

No gap between what's committed and what STATUS.md describes. No build
regressions. The single-source-of-truth risk here is unrelated to Task 1:
the *live-verification* claims (Chrome done, Firefox not run) are a separate
question addressed in Task 3 below, and are about operator-observed runtime
behavior, which a build pass cannot substitute for.

---

## Task 2 — Page-by-page inventory, read from actual source

Read directly from `src/pages/defs/*.ts(x)` and `src/pages/types.ts` — not
from STATUS.md's category summary table. One category at a time, in
`NAV_GROUPS` order (`src/pages/registry.ts`), committed after each. Columns:

- **Read** — nvram keys / hooks it reads.
- **Write** — `settings` pages either have a `write:` block (endpoint +
  rcService) or are tagged `writeExclusion` (write path exists in code but is
  a **hard-excluded category** — never live-submitted this project); `custom`
  pages either have no write path (pure display) or perform a specific
  user-triggered action (documented per-row).
- **Confidence** — the page's declared `confidence.read` / `.write` tier:
  `live-verified` (checked against the operator's RT-BE92U),
  `structural` (firmware-source-derived, not yet exercised live), or
  `unverified-write` (write path coded, never submitted).

### Status (`navGroup: 'status'`) — 2 views

| id | title | aspPage | Description | Reads | Write | Confidence |
|---|---|---|---|---|---|---|
| `dashboard` | Network Map | index.asp | Landing page: WAN state/IP/gateway/DNS/proto, LAN IP, firmware identity, uptime, and per-band (2.4/5/6 GHz) radio SSID+on/off. On SDN-managed units (`mtlancfg_support`), resolves the real broadcast SSID from `sdn_rl`'s MAINFH record's `apg{idx}_ssid` instead of the placeholder `wl{N}_ssid`. | nvram: `wan0_state_t`, `wan0_ipaddr`, `wan0_gateway`, `wan0_dns`, `wan0_proto`, `lan_ipaddr`, `wl0/1/2_radio`, `wl0/1/2_ssid` (ascii), conditionally `sdn_rl`/`apg{idx}_ssid`; hook: `uptime()` | none — read-only display | read: live-verified |
| `clients` | Clients | update_clients.asp | Merges DHCP leases with live wireless-station presence (`get_wclientlist()`) into one table; unnamed-hostname/`*` leases normalized to blank; auto-refreshes every 15s. | DHCP leases (via `fetchDhcpLeases`, dnsmasq lease file); hook: `get_wclientlist()` | none — read-only display | read: live-verified |

### Guest Network Pro (`navGroup: 'sdn'`) — 1 view

| id | title | aspPage | Description | Reads | Write | Confidence |
|---|---|---|---|---|---|---|
| `sdn` | Guest Network Pro | SDN.asp | Lists Self-Defined Networks (main/AiMesh-backhaul/legacy-guest) with per-network SSID, enable state, subnet/DHCP pool, and radio-assignment count. Read-only by deliberate design — profile create/edit is a coupled transaction across `sdn_rl`+`subnet_rl`+`vlan_rl`+`apg*_` families, out of scope. Gated on `mtlancfg_support`. | nvram(ascii): `sdn_rl`, `subnet_rl`, per-network `apg{idx}_ssid`, `apg{idx}_dut_list`; nvram: `apg{idx}_enable` | none — read-only by design | read: live-verified |

### AiProtection (`navGroup: 'aiprotection'`) — 1 view

| id | title | aspPage | Description | Reads | Write | Confidence |
|---|---|---|---|---|---|---|
| `aiprotection` | AiProtection | AiProtection_HomeProtection.asp | Trend Micro protection toggles: malicious-site blocking, C&C/infected-device blocking, two-way IPS, gated behind a master enable and a TM EULA-acceptance gate (`TM_EULA`). Deliberately excludes the page's client-side "Router Security Assessment"/"Secure All" panel (not a settings surface) and mail-alert/timestamp display fields. Gated on `bwdpi_support`; per-module fields further gated on their own `bwdpi_*_support` flags. | nvram: `wrs_protect_enable`, `wrs_mals_enable`, `wrs_cc_enable`, `wrs_vp_enable` | **implemented but hard-excluded** (`writeExclusion: 'firewall'` — action_script includes `restart_firewall`) via `applyapp`, rcService `restart_wrs;restart_firewall` | read: structural, write: unverified-write |

### Parental Controls (`navGroup: 'parental'`) — 1 view

| id | title | aspPage | Description | Reads | Write | Confidence |
|---|---|---|---|---|---|---|
| `parental` | Parental Controls — Time Scheduling | ParentalControl.asp | Per-client access control: full block or weekly time-window schedule. Recomposes 4 parallel `>`-joined, index-aligned nvram lists (enable/MAC/device name/V2 daytime-token schedule) into one virtual editable table (custom `\n`/`\t`-separated view format), decomposed back to the 4 real keys on write. | nvram: `MULTIFILTER_ALL`, `MULTIFILTER_ENABLE`, `MULTIFILTER_MAC`, `MULTIFILTER_MACFILTER_DAYTIME_V2`; nvram(ascii): `MULTIFILTER_DEVICENAME` | **implemented but hard-excluded** (`writeExclusion: 'firewall'` — iptables-backed, `restart_firewall`) via `applyapp` | read: structural, write: unverified-write |

### QoS (`navGroup: 'qos'`) — 4 views

| id | title | aspPage | Description | Reads | Write | Confidence |
|---|---|---|---|---|---|---|
| `qos` | QoS | QoS_EZQoS.asp | Master QoS enable + type selector (Traditional/Adaptive/Bandwidth Limiter/GeForce NOW/Cake), WAN up/down bandwidth (stored Kb/s, edited as Mb/s with 0/blank = Auto), WAN packet overhead/link-layer mode, Cake MPU. Adaptive QoS gated behind TM EULA. | nvram: `qos_enable`, `qos_type`, `qos_overhead`, `qos_atm`, `qos_mpu`, `qos_obw`, `qos_ibw` | implemented, `writeExclusion: null` (explicitly not firewall-excluded per operator scoping) via `applyapp`, rcService `restart_qos;restart_firewall` | read: live-verified, write: unverified-write |
| `qos-rules` | QoS Rules (Traditional) | Advanced_QOSUserRules_Content.asp | Default priority for unclassified traffic + user-defined Traditional-QoS rule list (IP/MAC, port, protocol, transferred-bytes range, priority). Only effective when QoS Type = Traditional. | nvram: `qos_default`; nvram(ascii): `qos_rulelist` | implemented, `writeExclusion: null` via `applyapp`, rcService `restart_qos;restart_firewall` | read: structural, write: unverified-write |
| `bandwidth-limiter` | Bandwidth Limiter | QoS_EZQoS.asp | Per-client/IP-range download/upload Mb/s caps + priority rank, stored as Kb/s (`qos_bw_rulelist`, plain `nvram_get` not ascii). Only effective when QoS Type = Bandwidth Limiter. | nvram: `qos_bw_rulelist` | implemented, `writeExclusion: null` via `applyapp`, rcService `restart_qos;restart_firewall` | read: live-verified, write: unverified-write |
| `qos-stats` | Classification | QoS_Stats.asp | Live per-traffic-class LAN/WAN byte totals, rate, and packet/s from `ajax_gettcdata.asp`; Traditional-QoS class ids mapped to Highest…Lowest labels, Adaptive-QoS DPI category names deliberately not re-derived. Auto-refreshes every 5s. Merlin-only. | hook via `/ajax_gettcdata.asp` (`tcdata_lan_array`/`tcdata_wan_array`); nvram: `qos_enable`, `qos_type` | none — read-only display | read: live-verified |

### Traffic Analyzer (`navGroup: 'traffic'`) — 5 views

| id | title | aspPage | Description | Reads | Write | Confidence |
|---|---|---|---|---|---|---|
| `traffic-realtime` | Real-time Traffic | Main_TrafficMonitor_realtime.asp | Live per-interface RX/TX throughput, 2s-polled netdev counters, ~4-minute rolling chart + all-interfaces table. | `update.cgi`-sourced netdev counters (`fetchNetdev`) | none — read-only display | read: live-verified |
| `traffic-last24` | Last 24 Hours | Main_TrafficMonitor_last24.asp | Average speed history over the last 24h in 2-minute buckets, per interface. | rstats speed-history feed (`fetchSpeedHistory`) | none — read-only display | read: live-verified |
| `traffic-daily` | Daily Traffic | Main_TrafficMonitor_daily.asp | Per-day download/upload/total usage table from rstats. | rstats daily-history feed (`fetchDailyHistory`) | none — read-only display | read: live-verified |
| `traffic-monthly` | Monthly Traffic | Main_TrafficMonitor_monthly.asp | Per-month download/upload/total usage table from rstats. Merlin-only. | rstats monthly-history feed (`fetchMonthlyHistory`) | none — read-only display | read: live-verified |
| `traffic-settings` | Traffic Monitoring Settings | Main_TrafficMonitor_settings.asp | rstats configuration: enable, save location/path, save frequency, monthly-cycle start day, backup-on-save, excluded interfaces. Merlin-only. | nvram: `rstats_enable`, `rstats_path`, `rstats_stime`, `rstats_offset`, `rstats_data`, `rstats_colors`, `rstats_exclude`, `rstats_bak` | implemented, `writeExclusion: null` via `applyapp`, rcService `restart_rstats` | read: live-verified, write: unverified-write |

### USB Applications (`navGroup: 'usb'`) — 4 views

| id | title | aspPage | Description | Reads | Write | Confidence |
|---|---|---|---|---|---|---|
| `samba` | Network Place (Samba) | Advanced_AiDisk_samba.asp | Samba enable, NetBIOS device name, workgroup, protocol version (SMBv1/v2/both), simpler naming, master-browser/WINS toggles, max login users, NTFS sparse-file option. Per-account/group share permissions out of scope. | nvram: `enable_samba`, `computer_name`, `st_samba_workgroup`, `smbd_protocol`, `smbd_simpler_naming`, `smbd_master`, `smbd_wins`, `st_max_user`, `usb_fs_ntfs_sparse` | implemented, `writeExclusion: null` via `applyapp`, rcService `restart_ftpsamba;restart_dnsmasq` — note: SMB protocol-version field carries an in-code hint flagging it as too risky to live-test (could break an in-progress mount) | read: structural, write: unverified-write |
| `ftp` | FTP Share | Advanced_AiDisk_ftp.asp | FTP enable, WAN access, TLS/SSL, max login users, server codepage. Per-account permissions out of scope; this firmware branch has no port/passive-mode fields. | nvram: `enable_ftp`, `ftp_wanac`, `ftp_tls`, `st_max_user`, `ftp_lang` | implemented, `writeExclusion: null` via `applyapp`, rcService `restart_ftpsamba` | read: structural, write: unverified-write |
| `mediaserver` | Media Server | mediaserver.asp | iTunes/DAAP server enable+name, DLNA server enable+name+rebuild-on-start+status webpage, manual shared-directory list (decomposed from two parallel `dms_dir_x`/`dms_dir_type_x` nvram lists into one 2-column view). | nvram: `daapd_enable`, `daapd_friendly_name`, `dms_enable`, `dms_friendly_name`, `dms_dir_manual`, `dms_rebuild`, `dms_web`; nvram(ascii): `dms_dir_x`, `dms_dir_type_x` | implemented, `writeExclusion: null` via `applyapp`, rcService `restart_media` | read: structural, write: unverified-write |
| `nfs` | NFS Exports | Advanced_AiDisk_NFS.asp | NFSD enable, legacy NFSv2 toggle, exported-filesystem list (path/access-list/options). Merlin-only; gated on `nfsd_support` for nav visibility only (page itself serves regardless, per live probe). | nvram: `nfsd_enable`, `nfsd_enable_v2`; nvram(ascii): `nfsd_exportlist` | implemented, `writeExclusion: null` via `applyapp`, rcService `restart_nasapps` | read: live-verified, write: unverified-write |

### Wireless (`navGroup: 'wireless'`) — 7 views

| id | title | aspPage | Description | Reads | Write | Confidence |
|---|---|---|---|---|---|---|
| `wireless-general` | General | Advanced_Wireless_Content.asp | Per-band (2.4/5/6 GHz instance selector) SSID/hide-SSID, Smart Connect toggle, auth method + WPA encryption/PSK/PMF/GTK-rekey, channel bandwidth + control channel (chanspec). MLO and wireless-mode (nmode_x) deliberately not modeled (see file header — MLO is SDN-managed on this generation; nmode_x has no editable row on this page/hardware combo). | nvram: `smart_connect_x`, `wl{p}_closed`, `wl{p}_auth_mode_x`, `wl{p}_crypto`, `wl{p}_mfp`, `wl{p}_wpa_gtk_rekey`, `wl{p}_bw`, `wl{p}_chanspec`; nvram(ascii): `wl{p}_ssid`, `wl{p}_wpa_psk` | implemented, **hard-excluded** (`writeExclusion: 'wireless'`) via `applyapp`, rcService `restart_wireless` | read: structural, write: unverified-write |
| `wps` | WPS | Advanced_WWPS_Content.asp | WPS enable + current band (2.4/5 GHz only — 6 GHz excluded, SAE/WPA3-only band incompatible with WPS). No per-band instance selector (band is itself a field value). | nvram: `wps_enable`, `wps_band_x` | implemented, **hard-excluded** (`wireless`) via `applyapp`, rcService `restart_wireless` | read: structural, write: unverified-write |
| `wds` | Bridge / WDS | Advanced_WMode_Content.asp | Per-band WDS mode (AP Only/WDS Only/Hybrid), connect-to-APs-in-list toggle, and the remote-AP MAC allowlist for bridging. | nvram: `wl{p}_mode_x`, `wl{p}_wdsapply_x`; nvram(ascii): `wl{p}_wdslist` | implemented, **hard-excluded** (`wireless`) via `applyapp`, rcService `restart_wireless` | read: structural, write: unverified-write |
| `wireless-macfilter` | Wireless MAC Filter | Advanced_ACL_Content.asp | Per-band MAC filter mode (disabled/allow-list/deny-list) and the MAC list itself (up to 64 entries). | nvram: `wl{p}_macmode`; nvram(ascii): `wl{p}_maclist_x` | implemented, **hard-excluded** (`wireless`) via `applyapp`, rcService `restart_wireless` | read: structural, write: unverified-write |
| `radius` | RADIUS Settings | Advanced_WSecurity_Content.asp | Per-band 802.1x RADIUS server IP, port, and shared secret for enterprise auth modes. Native page's own selector only offers 2.4/5 GHz; 6 GHz modeled here too but unverified against this specific page. | nvram: `wl{p}_radius_ipaddr`, `wl{p}_radius_port`, `wl{p}_radius_key` | implemented, **hard-excluded** (`wireless`) via `applyapp`, rcService `restart_wireless` | read: structural, write: unverified-write |
| `wireless-professional` | Professional | Advanced_WAdvanced_Content.asp | Per-band radio enable, AP isolation, roaming-assistant RSSI threshold, IGMP snooping, WiFi 7 mode/MU-MIMO/OFDMA (when `wifi7_support`), beacon/DTIM interval, fragmentation/RTS threshold, airtime fairness, Tx power. Regulatory region, wireless scheduler, and low-level chipset tuning knobs deliberately not modeled (hidden/irrelevant on this hardware per native page's own gating). | nvram: `wl{p}_radio`, `wl{p}_ap_isolate`, `wl{p}_user_rssi`, `wl{p}_igs`, `wl{p}_bcn`, `wl{p}_dtim`, `wl{p}_frag`, `wl{p}_rts`, `wl{p}_txpower`, `wl{p}_11be`, `wl{p}_ofdma`, `wl{p}_mumimo`, `wl{p}_atf` | implemented, **hard-excluded** (`wireless`) via `applyapp`, rcService `restart_wireless` | read: **live-verified**, write: unverified-write |
| `site-survey` | Site Survey | Advanced_Wireless_Survey.asp | Nearby-AP scan results (band/SSID/channel/security/signal/MAC) from `/apscan.asp`; a "Rescan" button triggers `restart_wlcscan` (configuration-free radio scan action, not a settings write) through the same write-guard as every other action — dry-run-previewed in read-only mode. Merlin-only. | `/apscan.asp` (`aplist`, `wlc_scan_state`) | user-triggered action only (rescan trigger, no nvram config write); `writeExclusion: null` | read: live-verified, write: unverified-write |

### LAN (`navGroup: 'lan'`) — 5 views

| id | title | aspPage | Description | Reads | Write | Confidence |
|---|---|---|---|---|---|---|
| `lan-ip` | LAN IP | Advanced_LAN_Content.asp | Router LAN IP/subnet mask, host name, domain name. | nvram: `lan_ipaddr`, `lan_netmask`, `lan_hostname`, `lan_domain` | implemented, **hard-excluded** (`excluded-restart` — `restart_net_and_phy`) via `applyapp` | read: live-verified, write: unverified-write |
| `dhcp` | DHCP Server | Advanced_DHCP_Content.asp | DHCP enable, domain name, pool range, lease time, gateway/DNS1/DNS2/WINS overrides, static-lease table (MAC→IP+DNS+hostname), DHCP query logging (Merlin addition). | nvram: `dhcp_enable_x`, `lan_domain`, `dhcp_start`, `dhcp_end`, `dhcp_lease`, `dhcp_gateway_x`, `dhcp_dns1_x`, `dhcp_dns2_x`, `dhcpd_dns_router`, `dhcp_wins_x`, `dhcp_static_x`, `dhcpd_querylog`; nvram(ascii): `dhcp_staticlist` | implemented, **hard-excluded** (`dhcp`) via `applyapp`, rcService `restart_net_and_phy` | read: live-verified, write: unverified-write |
| `static-route` | Route | Advanced_GWStaticRoute_Content.asp | Static-route enable + rule list (network/netmask/gateway/metric/interface). | nvram: `sr_enable_x`; nvram(ascii): `sr_rulelist` | implemented, **hard-excluded** (`excluded-restart` — `restart_net`) via `applyapp` | read: live-verified, write: unverified-write |
| `iptv` | IPTV | Advanced_IPTV_Content.asp | ISP VLAN profile (generic/manual only — carrier-specific profiles preserved but not selectable), STB port assignment, IGMP-proxy multicast routing + version + fast-leave, IGMP-snooping, udpxy port, TTL increment. | nvram: `switch_wantag`, `switch_stb_x`, `mr_enable_x`, `mr_igmp_ver`, `mr_qleave_x`, `emf_enable`, `udpxy_enable_x`, `ttl_inc_enable` | implemented, **hard-excluded** (`excluded-restart` — `restart_net`) via `applyapp` | read: live-verified, write: unverified-write |
| `switch-ctrl` | Switch Control | Advanced_SwitchCtrl_Content.asp | Jumbo frame + Spanning-Tree Protocol toggles. NAT-acceleration controls not exposed (HND platform, matches native page). Native page applies via full reboot. | nvram: `jumbo_frame_enable`, `lan_stp` | implemented, **hard-excluded** (`firmware-reboot-reset` — `reboot`, 120s wait) via `applyapp` | read: live-verified, write: unverified-write |

### WAN (`navGroup: 'wan'`) — 7 views

| id | title | aspPage | Description | Reads | Write | Confidence |
|---|---|---|---|---|---|---|
| `wan` | Internet Connection | Advanced_WAN_Content.asp | Per-WAN-unit instance page (primary/secondary): connection type (DHCP/Static/PPPoE/PPTP/L2TP — IPv6 transition protocols not modeled), static IP/DNS, MTU, PPPoE credentials, NAT/UPnP toggles, ISP host name/MAC-clone. Known limitation documented in-code: delta writes never post a bare `wan_unit` field, so a live Secondary-WAN apply could restart unit 0 instead of unit 1 — never exercised live. | nvram: `wan{p}_proto`, `wan{p}_enable`, `wan{p}_dhcpenable_x`, `wan{p}_ipaddr_x`, `wan{p}_netmask_x`, `wan{p}_gateway_x`, `wan{p}_dnsenable_x`, `wan{p}_dns1_x`, `wan{p}_dns2_x`, `wan{p}_pppoe_mtu`, `wan{p}_nat_x`, `wan{p}_upnp_enable`, `wan{p}_hostname`, `wan{p}_hwaddr_x`, `wan{p}_mtu`, `wan{p}_dhcp_qry`; nvram(ascii): `wan{p}_pppoe_username`, `wan{p}_pppoe_passwd` | implemented, **hard-excluded** (`wan`) via `applyapp`, rcService `restart_wan_if` | read: live-verified, write: unverified-write |
| `dual-wan` | Dual WAN | Advanced_WANPort_Content.asp | WAN/secondary-interface pairing (WAN-only / +USB-modem / +LAN-port), failover/failback/load-balance mode + ratio, DNS-probe and ping-based failover watchdog tuning. Per-ISP policy routing and USB hot-standby not modeled. Gated on `dualwan_support`. | nvram: `wans_dualwan`, `wans_mode`, `wans_lb_ratio`, `wans_usb_bk`, `wandog_enable`, `wandog_target`, `wandog_interval`, `wandog_maxfail`, `wandog_fb_count`, `dns_probe`, `dns_probe_host` | implemented, **hard-excluded** (`wan`) via `applyapp`, rcService `reboot` (70s wait) | read: structural, write: unverified-write |
| `port-trigger` | Port Trigger | Advanced_PortTrigger_Content.asp | Enable + trigger-port/protocol → incoming-port/protocol rule list. | nvram: `autofw_enable_x`; nvram(ascii): `autofw_rulelist` | implemented, **hard-excluded** (`firewall`) via `applyapp`, rcService `restart_firewall` | read: structural, write: unverified-write |
| `port-forwarding` | Port Forwarding | Advanced_VirtualServer_Content.asp | Enable + two parallel rule lists (primary-WAN `vts_rulelist`, secondary-WAN `vts1_rulelist` when dual-WAN) — service name, external/internal port, internal IP, protocol, optional source-IP restriction. | nvram: `vts_enable_x`; nvram(ascii): `vts_rulelist`, `vts1_rulelist` | implemented, **hard-excluded** (`firewall`) via `applyapp`, rcService `restart_firewall` | read: structural, write: unverified-write |
| `dmz` | DMZ | Advanced_Exposed_Content.asp | Exposed-station IP for primary (and secondary, load-balance dual-WAN) WAN — enable state is implicit (blank IP = disabled, no separate enable key), matching native behavior. Battle.net auto-opened-IP field shown read-only (no editable control exists natively). | nvram: `dmz_ip`, `dmz1_ip`, `sp_battle_ips`, `wans_mode` | implemented, **hard-excluded** (`firewall`) via `applyapp`, rcService `restart_firewall` | read: structural, write: unverified-write |
| `ddns` | DDNS | Advanced_ASUSDDNS_Content.asp | DDNS client enable, WAN-interface selector (dual-WAN load-balance only), provider/server, hostname, username/password, wildcard, Merlin's periodic re-check addition. Let's Encrypt cert issuance and always-hidden regular-refresh rows not modeled. | nvram: `ddns_enable_x`, `ddns_wan_unit`, `ddns_server_x`, `ddns_hostname_x`, `ddns_username_x`, `ddns_passwd_x`, `ddns_wildcard_x`, `ddns_regular_check`, `wans_mode` | implemented, `writeExclusion: null` (restart_ddns not on the excluded-restart list) via `applyapp`, rcService `restart_ddns` | read: structural, write: unverified-write |
| `nat-passthrough` | NAT Passthrough | Advanced_NATPassThrough_Content.asp | PPTP/L2TP/IPSec/RTSP/H.323/SIP passthrough toggles, PPPoE relay + interface selector, FTP ALG port. SIP NAT-helper mode omitted (hard-gated to a different model in native source, never renders on this router). | nvram: `fw_pt_pptp`, `fw_pt_l2tp`, `fw_pt_ipsec`, `fw_pt_rtsp`, `fw_pt_h323`, `fw_pt_sip`, `fw_pt_pppoerelay`, `pppoerelay_unit`, `vts_ftpport`, `wans_mode` | implemented, **hard-excluded** (`firewall`) via `applyapp`, rcService `restart_firewall;restart_pppoe_relay` | read: structural, write: unverified-write |

### IPv6 (`navGroup: 'ipv6'`) — 1 view

| id | title | aspPage | Description | Reads | Write | Confidence |
|---|---|---|---|---|---|---|
| `ipv6` | IPv6 | Advanced_IPv6_Content.asp | Full WAN/LAN IPv6 connection setup: connection type (disabled/native DHCPv6/static/passthrough/FLET'S/6to4/6in4/6rd tunnels), tunnel + prefix-delegation parameters, LAN prefix/DHCPv6 pool, DNS, RADVD. Restores several detail rows (tunnel modes, DHCPv6-PD, default-route-accept, release-on-exit, manual DNS) that the native page's own HTML permanently hides (`display:none`, no un-hide path) even though their nvram keys are live and validated — treated as real admin-facing settings here. IPv6 *firewall* rules live on a separate page (`firewall.ts`), not duplicated. Gated on `rcSupport` having `ipv6`. | nvram: 30 keys spanning `ipv6_service`, `ipv6_only`, `ipv6_ifdev`, `ipv6_dhcp_pd`, `ipv6_accept_defrtr`, `ipv6_dhcp6c_release`, tunnel/6rd params, `ipv6_ipaddr`/`ipv6_prefix*`/`ipv6_gateway`/`ipv6_rtr_addr`, DHCPv6 pool/lifetime, `ipv6_dnsenable`/`ipv6_dns1-3`, `ipv6_radvd` | implemented, **hard-excluded** (`excluded-restart` — `restart_net`, 30s wait) via `applyapp` | read: structural, write: unverified-write |

### VPN (`navGroup: 'vpn'`) — 9 views

| id | title | aspPage | Description | Reads | Write | Confidence |
|---|---|---|---|---|---|---|
| `vpn-status` | VPN Status | Advanced_VPNStatus.asp | Unified live status (connected/connecting/error/stopped) for OpenVPN servers (2) + clients (5), WireGuard clients (5), and PPTP server running-state, from `/ajax_vpn_status.asp`. Auto-refreshes every 5s. Merlin-only. | `/ajax_vpn_status.asp` scalars; nvram(ascii) instance descriptions (`vpn_client{1-5}_desc`, `wgc{1-5}_desc`) | none — read-only display | read: live-verified |
| `openvpn-client` | OpenVPN Client | Advanced_OpenVPNClient_Content.asp | 5-instance OpenVPN client family: enable (decomposed from single global `vpn_clientx_eas` comma-list — no per-instance enable key exists), description, interface/protocol/server/port, NAT/firewall/killswitch, TLS vs static-key auth (+username/password), cipher/digest/compression, custom config. Cert/key BLOBs and .ovpn import out of scope. Gated on `openvpnd_support`. | nvram: `vpn_clientx_eas` + ~20 `vpn_client{p}_*` keys; nvram(ascii): desc/username/password/ncp_ciphers/cn/custom3 | implemented, **hard-excluded** (`vpn`) via `applyapp`, rcService `restart_vpnclient{p}` | read: live-verified, write: unverified-write |
| `wireguard-client` | WireGuard Client | Advanced_WireguardClient_Content.asp | 5-instance WireGuard client family: enable, description, NAT/firewall/killswitch, private key/MTU/address/DNS (interface), and peer public key/PSK/allowed-IPs/endpoint/keepalive. Config-file import out of scope. Gated on `wireguard_support`. | nvram: `wgc{p}_enable`, `_nat`, `_fw`, `_enforce`, `_mtu`, `_ep_port`, `_alive`; nvram(ascii): `_desc`, `_priv`, `_addr`, `_dns`, `_ppub`, `_psk`, `_aips`, `_ep_addr` | implemented, **hard-excluded** (`vpn`) via `applyapp`, rcService `restart_wgc` | read: live-verified, write: unverified-write |
| `vpn-fusion` | VPN Fusion | Advanced_VPNClient_Content.asp | Multi-profile client-routing manager (assigns OpenVPN/WireGuard unit refs or inline PPTP/L2TP creds to devices/WAN failover). **Deliberately read-only**: the stored encoding packs protocol-dependent fields into two position-aligned nvram keys too entangled to safely reconstruct as an editable form — shows a human-readable profile summary plus raw key dumps. Gated on `vpnc_support`. | nvram(ascii): `vpnc_clientlist`, `vpnc_pptp_options_x_list` | **none — deliberately read-only** (no `write` block at all, distinct from the hard-excluded pages which do have one) | read: live-verified |
| `openvpn-server` | OpenVPN Server | Advanced_VPN_OpenVPN.asp | 2-instance OpenVPN server family: enable (decomposed from global `vpn_serverx_start` comma-list), interface/protocol/port, TLS vs static-key auth, RSA key size, TLS-auth/HMAC/digest, subnet/DHCP pool or point-to-point endpoints, cipher/compression, client-specific-config allow/deny list (CN+subnet+netmask+push, decomposed from a padded stored format), optional IPv6. Username/password client list, custom-config, and cert/key BLOBs out of scope (see in-code rationale for each). Gated on `openvpnd_support`. | nvram: `vpn_serverx_start` + ~25 `vpn_server{p}_*` keys; nvram(ascii): `vpn_server{p}_ccd_val` | implemented, **hard-excluded** (`vpn`) via `applyapp`, rcService `restart_vpnserver{p}` | read: live-verified, write: unverified-write |
| `wireguard-server` | WireGuard Server | Advanced_WireguardServer_Content.asp | Single-instance (`wgs1_`, no selector — router only exposes one) server-wide interface settings: enable, DNS/IPv6-NAT/PSK toggles, keepalive, address, listen port; private/public key shown read-only. Per-peer management (up to 10 peers) deferred, not modeled. Gated on `wireguard_support`. | nvram: `wgs1_enable`, `_dns`, `_nat6`, `_psk`, `_alive`, `_addr`, `_port`, `_priv`, `_pub` | implemented, **hard-excluded** (`vpn`) via `applyapp`, rcService `restart_wgs;restart_dnsmasq` — additional documented uncertainty: no confirmed `validate_instance()` branch exists for direct `wgs1_*` writes bypassing the native page's unit-selector indirection | read: structural, write: unverified-write |
| `pptp-server` | PPTP VPN Server | Advanced_VPN_PPTP.asp | Enable, client IP pool (decomposed start-address + end-octet), broadcast-to-clients toggle, MPPE encryption bitmask (decomposed into 3 toggles), username/password client list. CHAP method, DNS/WINS overrides, MRU/MTU, Samba integration, per-user static routes not modeled. Gated on `pptpd_support`. | nvram: `pptpd_enable`, `pptpd_broadcast`, `pptpd_clients`, `pptpd_mppe`; nvram(ascii): `pptpd_clientlist` | implemented, **hard-excluded** (`vpn`) via `applyapp`, rcService `restart_pptpd` | read: structural, write: unverified-write |
| `vpn-director` | VPN Director | Advanced_VPNDirector.asp | Policy-routing rule list: per-rule enable, description, local/remote IP-or-CIDR, target interface (WAN / OpenVPN 1-5 / WireGuard 1-5). Up to 199 rules, evaluated top-down (WGC rules take native priority over OVPN). Merlin-only; gated on OpenVPN or WireGuard support. | nvram(ascii): `vpndirector_rulelist` | implemented, **hard-excluded** (`vpn`) via `applyapp`, rcService `restart_vpnrouting0` | read: live-verified, write: unverified-write |
| `ipsec-server` | IPSec VPN Server | Advanced_VPN_IPSec.asp | Single enable toggle for the IPSec server; pre-shared key, client-access mode, client-IP-pool prefix, DNS/WINS push (all decomposed from the 38-field `ipsec_profile_1` composite string — only 5 of 38 positions are user-editable, the rest passed through unchanged), dead-peer-detection, and a merged IKEv1/IKEv2 client-account list (reconstructed from two version-sharded nvram keys). **Documented functional gap**: `ipsec_profile_2` (IKEv2 cert profile), which the native page always regenerates wholesale on save, is not reproduced — enabling via this page won't refresh it. Instant Guard (separate feature/page) and the dead/hidden dual-WAN interface row are out of scope. Gated on `ipsec_srv_support`. | nvram: `ipsec_server_enable`, `ipsec_block_intranet`, `ipsec_profile_1`; nvram(ascii): `ipsec_client_list_1`, `ipsec_client_list_2` | implemented, **hard-excluded** (`vpn`) via `applyapp`, rcService `ipsec_start` (documented: same command used for both enable and disable, since the native disable/enable branch can't be expressed statically) | read: structural, write: unverified-write |

### Firewall (`navGroup: 'firewall'`) — 5 views

| id | title | aspPage | Description | Reads | Write | Confidence |
|---|---|---|---|---|---|---|
| `firewall-general` | General | Advanced_BasicFirewall_Content.asp | Firewall enable, DoS protection, logged-packet type, WAN-ping response, plus the IPv4 inbound-rule table (protocol/local IP/port, decomposed from a padded 6-field stored record). | nvram: `fw_enable_x`, `fw_dos_x`, `fw_log_x`, `misc_ping_x`, `fw_wl_enable_x`; nvram(ascii): `filter_wllist` | implemented, **hard-excluded** (`firewall`) via `applyapp`, rcService `restart_firewall` | read: structural, write: unverified-write |
| `url-filter` | URL Filter | Advanced_URLFilter_Content.asp | Enable + black/white-list mode + URL-keyword list (decomposed from a fixed `1>ALL>keyword` stored prefix). | nvram: `url_enable_x`, `url_mode_x`; nvram(ascii): `url_rulelist` | implemented, **hard-excluded** (`firewall`) via `applyapp`, rcService `restart_firewall` | read: structural, write: unverified-write |
| `keyword-filter` | Keyword Filter | Advanced_KeywordFilter_Content.asp | Enable + keyword list blocking pages containing matched text. | nvram: `keyword_enable_x`; nvram(ascii): `keyword_rulelist` | implemented, **hard-excluded** (`firewall`) via `applyapp`, rcService `restart_firewall` | read: structural, write: unverified-write |
| `network-service-filter` | Network Services Filter | Advanced_Firewall_Content.asp | LAN→WAN filter enable, black/white-list default, filtered ICMP types, active-schedule (per-day toggles decomposed from a 7-char bitmask + two HHMMHHMM time windows for weekday/weekend), and the source/dest IP+port+protocol filter-rule list. | nvram: `fw_lw_enable_x`, `filter_lw_default_x`, `filter_lw_icmp_x`, `filter_lw_date_x`, `filter_lw_time_x`, `filter_lw_time2_x`; nvram(ascii): `filter_lwlist` | implemented, **hard-excluded** (`firewall`) via `applyapp`, rcService `restart_firewall` | read: **live-verified**, write: unverified-write |
| `ipv6-firewall` | IPv6 Firewall | Advanced_BasicFirewall_Content.asp | Enable + inbound rule list (service name/remote IP/local IP/port/protocol). All inbound IPv6 to LAN blocked by default when enabled. 3006.x firmware structural note: this firmware has no dedicated IPv6-firewall .asp — it's merged onto the basic-firewall page, modeled here as its own view over the same native page. Gated on `rcSupport` having `ipv6`. | nvram: `ipv6_fw_enable`; nvram(ascii): `ipv6_fw_rulelist` | implemented, **hard-excluded** (`firewall`) via `applyapp`, rcService `restart_firewall` | read: structural, write: unverified-write |

### DNS Director (`navGroup: 'dnsdirector'`) — 1 view

| id | title | aspPage | Description | Reads | Write | Confidence |
|---|---|---|---|---|---|---|
| `dns-director` | DNS Director | DNSDirector.asp | Merlin-exclusive per-client DNS redirection: enable, global preset (18 real presets across System/Unfiltered/Security/Family-friendly groups, flattened from the native optgroup structure) + 3 custom IPv4/IPv6 DNS pairs, and up to 64 per-client MAC→redirection rules. Client rules are sharded across 6 nvram keys (255-char native hard cap each, HND-platform path) and re-sharded byte-compatibly on write. SDN/Guest-Network-Pro per-network redirection out of scope. Gated on `dnsfilter_support`. | nvram: `dnsfilter_enable_x`, `dnsfilter_mode`, `dnsfilter_custom1-3`, `dnsfilter_custom61-63`; nvram(ascii): `dnsfilter_rulelist` + `_rulelist1..5` | implemented, `writeExclusion: null` via `applyapp`, rcService `restart_dnsfilter` | read: live-verified, write: unverified-write |

### Administration (`navGroup: 'admin'`) — 7 views

Note: STATUS.md's summary table lists this category as "System, Time/NTP, SSH, Tweaks, Security notifications, Firmware (view), Backup (view)" — 7 items, matching what's actually registered (6 in `admin.ts` + `tweaksPage`, which is registered separately in `defs/index.ts` but carries `navGroup: 'admin'`).

| id | title | aspPage | Description | Reads | Write | Confidence |
|---|---|---|---|---|---|---|
| `system` | System | Advanced_System_Content.asp | Local HTTP/HTTPS access + ports, WAN remote-admin access + ports, login captcha, auto-logout timeout, access-restriction allowlist (IP+Web UI/SSH scope), telnet enable (native UI itself force-hides this control on current-gen models), USB HDD spin-down, NAT-redirect notice, scheduled reboot (per-day + time, decomposed from an 11-char bitmask+HHMM). One of 3 focused views split out of one large native form (see `system-time`, `ssh`); login credentials and HTTPS cert management deliberately excluded (unsafe to round-trip / session-risk). | nvram: 15 keys incl. `http_enable`, `http_lanport`, `https_lanport`, `misc_http_x`, `misc_httpport_x`, `misc_httpsport_x`, `captcha_enable`, `http_autologout`, `enable_acc_restriction`, `telnetd_enable`, `usb_idle_enable`, `usb_idle_timeout`, `nat_redirect_enable`, `reboot_schedule_enable`, `reboot_schedule`; nvram(ascii): `restrict_rulelist` | implemented, `writeExclusion: null` via `applyapp`, rcService `restart_time;restart_httpd;restart_upnp` (page's static default; actual native JS branches dynamically per changed field — documented as a known simplification) | read: live-verified, write: unverified-write |
| `system-time` | Time / NTP | Advanced_System_Content.asp | Time zone (curated ~24-entry subset of the native ~90-entry list; unlisted zones still round-trip safely), primary+secondary NTP server, Merlin local NTP server enable + intercept-client-requests. Second of the 3 views over the same native form. | nvram: `time_zone`, `ntp_server0`, `ntp_server1`, `ntpd_enable`, `ntpd_server_redir` | implemented, `writeExclusion: null` via `applyapp`, rcService `restart_time` (narrower override per category brief) | read: live-verified, write: unverified-write |
| `ssh` | SSH | Advanced_System_Content.asp | Merlin SSH (dropbear) enable (off/LAN-only/LAN+WAN), port-forwarding allow (hard-excluded from live testing — session-risk, same class as HTTPS cert regen), port, password-login allow, authorized keys textarea. Third of the 3 views over the same native form. Merlin-only, gated on `ssh_support`. | nvram: `sshd_enable`, `sshd_forwarding`, `sshd_port`, `sshd_pass`, `sshd_authkeys` | implemented, `writeExclusion: null` via `applyapp`, rcService `restart_time;restart_httpd;restart_upnp` (same native form as `system`) | read: live-verified, write: unverified-write |
| `security-notification` | Security Notifications | Main_Security_Change_Notification.asp | Read-only viewer for the firmware/package security-update history log. Empirically confirmed to carry **no editable nvram fields and no apply path at all** — the native page's only content is a raw log-file dump (not an nvram key) plus a client-side-only Refresh button. Modeled as an intro-only page with zero fields. Merlin-only. | none (no `read.nvram`/`nvramAscii`/`hooks`) | **none — page has no write path natively** | read: live-verified |
| `firmware` | Firmware | Advanced_FirmwareUpgrade_Content.asp | Read-only: current firmware version display + last online update-check result. Firmware check/download/upgrade (and AiMesh node upgrade, Merlin manual .zip upload) deliberately not implemented — apply via reboot/flash, excluded from live testing by scoping. | nvram: `firmver`, `buildno`, `extendno`, `webs_state_info`, `webs_state_flag` | **none — read-only by design**; `writeExclusion: 'firmware-reboot-reset'` tag present even though no `write` block exists, documenting why one was never added | read: live-verified |
| `backup` | Backup / Restore | Advanced_SettingBackup_Content.asp | Read-only: shows whether the JFFS custom-scripts partition is mounted. Restore-to-default, save/upload .CFG, and JFFS backup/restore are all button/file-upload actions (not nvram writes) that apply via reboot — excluded from this build; use the native page for those actions. | nvram: `jffs2_on` | **none — read-only by design**; `writeExclusion: 'firmware-reboot-reset'` tag present, same rationale as `firmware` | read: live-verified |
| `tweaks` | Tweaks | Tools_OtherSettings.asp | Netfilter conntrack table size + per-TCP-state/UDP timeouts (decomposed from two space-joined nvram strings), WebUI-redirect-to-asusrouter.com (hard-excluded from live testing), IPv6 neighbor-solicitation drop, Asusnat tunnel disable, DHCP empty-WPAD. **The only page in the project with `confidence.write: 'live-verified'`** — all 4 of its non-excluded fields were the human-supervised live-write baseline from a prior session (`docs/WRITE_PATH_CHARACTERIZATION.md`). Registered separately from `admin.ts` (in `defs/index.ts`) but shares its `navGroup: 'admin'`. Merlin-only. | nvram: `ct_max`, `ct_tcp_timeout`, `ct_udp_timeout`, `http_dut_redir`, `ipv6_ns_drop`, `aae_disable_force`, `dhcpd_send_wpad` | implemented, `writeExclusion: null` via `applyapp`, rcService `restart_conntrack` | read: live-verified, **write: live-verified** |

**Committed as part of this entry.**
