# Navigation Taxonomy Proposal

Planning document only. No code, nav model, registry, or page-definition file is
changed by this document.

Source of truth for every statement below is the page-definition source under
`src/pages/defs/` plus `src/pages/registry.ts` (nav model) and
`src/pages/defs/index.ts` (registration order) — read page by page, not from the
category table in `docs/CURRENT_STATE_AUDIT.md`. Where a page's "current name"
is given, it is the name the extension actually renders in nav today
(`navLabel` when set, otherwise `title`); the underlying `.asp` filename is
never used as an identity, since no end user of this extension has seen it.

---

## 1. Summary

| Measure | Now | Proposed |
| --- | --- | --- |
| Top-level categories | 18 | **12** |
| Registered views | 73 | 73 (all placed) |
| Categories with real sub-headers | 0 | **6** |
| Single-page categories | 5 | **0** |
| Largest category | 9 (VPN) | 12 (Security & Access Control) |
| Smallest category | 1 (×5) | 2 (Merlin's Cloak) |

### Categories that gained real sub-headers (6)

Sub-headers were added only where the page count is roughly five or more **and**
the pages fall into clusters that a user would name the same way independently.

| Category | Pages | Split | Why the split is real |
| --- | --- | --- | --- |
| Wireless | 7 | 4 / 3 | Configuring the radio and the network it broadcasts (SSID, security, radio tuning, WDS bridging, channel scan) is a different task from controlling *which clients may join* (allow/deny MAC list, WPS pairing, RADIUS auth). Different nvram families too: `wl{p}_ssid/_bw/_chanspec/_11be/_mode_x` vs `wl{p}_macmode/_maclist_x`, `wps_*`, `wl{p}_radius_*`. |
| Local Network | 6 | 3 / 3 | Addressing/routing (`lan_ipaddr`, `dhcp_*`, `sr_rulelist`) vs network segmentation and physical ports (`sdn_rl`/`subnet_rl`/`apg*`, `switch_wantag`/`switch_stb_x`/`mr_*`, `jumbo_frame_enable`/`lan_stp`). |
| Security & Access Control | 12 | 3 / 4 / 5 | Three genuinely distinct jobs: stateful firewall policy, inbound NAT exposure, and per-device/per-content restriction. All twelve write through `restart_firewall`-class services, which is exactly why the flat list would be unreadable. |
| VPN | 9 | 1 / 4 / 4 | Direction is the dominant axis: this router dialling out (`vpn_client{p}_*`, `wgc{p}_*`, `vpnc_clientlist`, `vpndirector_rulelist`) vs remote users dialling in (`vpn_server{p}_*`, `wgs1_*`, `pptpd_*`, `ipsec_profile_1`). |
| Traffic & Bandwidth | 9 | 5 / 4 | Observing usage (`rstats_*` history + live throughput feeds) vs shaping it (`qos_*`). |
| Administration | 7 | 2 / 2 / 3 | How you reach the router, what the router itself runs, and lifecycle maintenance. |

Categories deliberately **kept flat**: Overview (3), Internet Connection (4),
USB Storage & Sharing (4), Live Status & Logs (7), Network Diagnostics (3),
Merlin's Cloak (2).

Live Status & Logs is the notable one: it has seven pages, which clears the size
threshold, but it has **no clean split**. The obvious candidate — "event logs"
vs "live state tables" — collapses on inspection, because the Wireless Log page
(`Main_WStatus_Content.asp`) is not a log at all; it renders the current
associated-station arrays. That would leave a one-page "logs" cluster and a
six-page "tables" cluster, which is a sub-header for its own sake. Flat.

### Single-page orphans (5 → 0 consolidated, 0 kept standalone)

| Orphan category (1 page each) | Consolidated into | Genuine functional relationship |
| --- | --- | --- |
| Guest Network Pro | Local Network › Segments & Ports | The page reads `sdn_rl` / `subnet_rl` / `apg*_*` — per-network subnet, DHCP pool and VLAN index. It is network segmentation that happens to broadcast an SSID. |
| AiProtection | Security & Access Control › Content & Device Restrictions | `wrs_*` malicious-site / C&C / IPS blocking, applied with `restart_wrs;restart_firewall`. It is a filtering feature sharing the firewall write path. |
| Parental Controls | Security & Access Control › Content & Device Restrictions | `MULTIFILTER_*` per-client block/schedule, applied with `restart_firewall` as iptables rules. Same mechanism as the other restriction pages. |
| DNS Director | Security & Access Control › Content & Device Restrictions | `dnsfilter_*` forces named clients onto a chosen resolver, largely for filtering services. Restriction by DNS. |
| IPv6 | Internet Connection | Its primary field is `ipv6_service` (the IPv6 WAN connection type), directly parallel to `wan{p}_proto` on Internet Setup. |

No single-page item ended up genuinely homeless, so no new standalone
single-page category is proposed.

### Structural note (not a page placement)

The current nav renders three fixed section bands — `general` / `advanced` /
`tools` (`src/pages/registry.ts:9-28`, consumed in `src/ui/App.tsx:111-121`).
The proposed twelve categories no longer align to that split: Security & Access
Control, for instance, absorbs pages from both the "general" band (AiProtection,
Parental Controls) and the "advanced" band (Firewall, WAN's NAT pages). The
proposal therefore assumes a **single ordered list of twelve categories** with
the extension's own category last, and the `section` field either dropped or
collapsed to one label. This is flagged here rather than silently assumed.

---

## 2. Full proposed tree

Order within each category is proposed final order. Each page carries a
one-line note on what it actually does and the nvram/write path it touches, so
the placement argument is checkable without opening the source.

### 1. Overview

*Flat — 3 pages.*

| # | Page | What it does | Backing data / write path |
| --- | --- | --- | --- |
| 1 | Router Status | WAN state, IP, gateway, DNS, connection type; LAN address; firmware, branch, uptime; per-band SSID and radio state | `wan0_state_t/_ipaddr/_gateway/_dns/_proto`, `lan_ipaddr`, `wl0-2_radio`, `wl0-2_ssid` (ascii), `sdn_rl`→`apg{n}_ssid` on SDN units, `uptime()` hook. Read-only |
| 2 | Connected Devices | DHCP leases merged with live wireless stations, band badge per MAC | `Main_DHCPStatus_Content.asp` lease feed + `get_wclientlist()`. Read-only |
| 3 | Router Resources | CPU model/load, memory, swap, nvram and JFFS usage, conntrack count, per-band associated-client counts, CFE and driver versions | `ajax_sysinfo.asp` feed + `sysinfo("…")` scalar hooks. Read-only |

### 2. Wireless

*Sub-headers — 7 pages.*

**› Radio & Network**

| # | Page | What it does | Backing data / write path |
| --- | --- | --- | --- |
| 4 | Wi-Fi Name & Security | Per-band SSID, hidden-SSID, auth method, encryption, PSK, PMF, group-key rotation, bandwidth, control channel; Smart Connect master switch | `wl{p}_ssid`/`_wpa_psk` (ascii), `wl{p}_closed/_auth_mode_x/_crypto/_mfp/_wpa_gtk_rekey/_bw/_chanspec`, `smart_connect_x` → `restart_wireless` (excluded: wireless) |
| 5 | Advanced Radio Settings | Radio enable, AP isolation, roaming assistant, IGMP snooping, Wi-Fi 7 mode, MU-MIMO/OFDMA, beacon/DTIM/frag/RTS, airtime fairness, Tx power | `wl{p}_radio/_ap_isolate/_user_rssi/_igs/_11be/_ofdma/_mumimo/_bcn/_dtim/_frag/_rts/_atf/_txpower` → `restart_wireless` (excluded: wireless) |
| 6 | Wireless Bridging (WDS) | AP-only / WDS-only / hybrid mode plus the remote-AP MAC list | `wl{p}_mode_x/_wdsapply_x`, `wl{p}_wdslist` (ascii) → `restart_wireless` (excluded: wireless) |
| 7 | Nearby Wi-Fi Scan | Lists surrounding APs (band, SSID, channel, security, signal, MAC) and triggers a rescan | `/apscan.asp` `aplist` + `wlc_scan_state`; rescan action posts `restart_wlcscan` through the write guard |

**› Client Access**

| # | Page | What it does | Backing data / write path |
| --- | --- | --- | --- |
| 8 | Device Allow/Block List | Per-band accept/reject mode and the MAC list it applies to | `wl{p}_macmode`, `wl{p}_maclist_x` (ascii) → `restart_wireless` (excluded: wireless) |
| 9 | Push-Button Pairing (WPS) | WPS enable and which band it pairs on | `wps_enable`, `wps_band_x` → `restart_wireless` (excluded: wireless) |
| 10 | Enterprise Authentication (RADIUS) | External 802.1X auth server address, port, shared secret, per band | `wl{p}_radius_ipaddr/_port/_key` → `restart_wireless` (excluded: wireless) |

### 3. Local Network

*Sub-headers — 6 pages.*

**› Addressing & Routing**

| # | Page | What it does | Backing data / write path |
| --- | --- | --- | --- |
| 11 | Router Address & Hostname | The router's own LAN IP, mask, host name, domain | `lan_ipaddr/_netmask/_hostname/_domain` → `restart_net_and_phy` (excluded: restart class) |
| 12 | Address Assignment (DHCP) | DHCP server enable, pool, lease time, gateway, DNS/WINS advertisement, query logging, manual MAC→IP reservations | `dhcp_enable_x/_start/_end/_lease/_gateway_x/_dns1_x/_dns2_x/_wins_x`, `dhcpd_dns_router`, `dhcpd_querylog`, `dhcp_staticlist` (ascii) → `restart_net_and_phy` (excluded: dhcp) |
| 13 | Static Routes | Manual route table entries with metric and interface | `sr_enable_x`, `sr_rulelist` (ascii) → `restart_net` (excluded: restart class) |

**› Segments & Ports**

| # | Page | What it does | Backing data / write path |
| --- | --- | --- | --- |
| 14 | Separate Networks & Guest Wi-Fi | Read-only listing of the self-defined networks: name, SSID, enable state, subnet, DHCP pool, radio assignments | `sdn_rl`, `subnet_rl`, `apg{n}_ssid/_enable/_dut_list`. Read-only by design — profile edits are a coupled multi-key transaction this build does not model |
| 15 | IPTV & Multicast | ISP/VLAN profile, set-top-box port, IGMP proxy and version, fast leave, efficient multicast forwarding, udpxy port, TTL increment | `switch_wantag`, `switch_stb_x`, `mr_enable_x/_igmp_ver`, `mr_qleave_x`, `emf_enable`, `udpxy_enable_x`, `ttl_inc_enable` → `restart_net` (excluded: restart class) |
| 16 | Ethernet Port Settings | Jumbo frames and spanning tree on the built-in switch | `jumbo_frame_enable`, `lan_stp` → `reboot` (excluded: firmware/reboot/reset) |

### 4. Internet Connection

*Flat — 4 pages.*

| # | Page | What it does | Backing data / write path |
| --- | --- | --- | --- |
| 17 | Internet Setup | Per-WAN-unit connection type (DHCP/static/PPPoE/PPTP/L2TP), addressing, DNS, PPP credentials, MTU, NAT/UPnP, ISP host name and MAC clone | `wan{p}_proto/_enable/_dhcpenable_x/_ipaddr_x/…/_mtu/_nat_x/_upnp_enable/_hostname/_hwaddr_x`, `wan{p}_pppoe_username/_passwd` (ascii) → `restart_wan_if` (excluded: wan) |
| 18 | Second Connection & Failover | Dual-WAN pairing and mode, load-balance ratio, USB-modem backup, DNS/ping watchdog thresholds | `wans_dualwan/_mode/_lb_ratio/_usb_bk`, `wandog_*`, `dns_probe*` → `reboot` (excluded: wan) |
| 19 | IPv6 Setup | IPv6 connection type (native/static/passthrough/6to4/6in4/6rd), prefix delegation, tunnel parameters, LAN prefix, DHCPv6 pool and lifetime, RA, IPv6 DNS | `ipv6_service` plus ~30 `ipv6_*` keys → `restart_net` (excluded: restart class) |
| 20 | Dynamic Hostname (DDNS) | DDNS provider, host name, credentials, wildcard, periodic re-verification, which WAN unit registers | `ddns_enable_x/_server_x/_hostname_x/_username_x/_passwd_x/_wildcard_x/_regular_check/_wan_unit` → `restart_ddns` |

### 5. Security & Access Control

*Sub-headers — 12 pages.*

**› Firewall**

| # | Page | What it does | Backing data / write path |
| --- | --- | --- | --- |
| 21 | Firewall Basics & Inbound Rules | Firewall master switch, DoS protection, packet logging, WAN ping response, plus the IPv4 inbound rule table | `fw_enable_x/_dos_x/_log_x`, `misc_ping_x`, `fw_wl_enable_x`, `filter_wllist` (ascii) → `restart_firewall` (excluded: firewall) |
| 22 | IPv6 Firewall | Default-deny inbound IPv6 with per-service exceptions | `ipv6_fw_enable`, `ipv6_fw_rulelist` (ascii) → `restart_firewall` (excluded: firewall) |
| 23 | Outbound Traffic Rules | LAN→Internet service filter: black/white list mode, ICMP types, weekday/weekend active windows, source/destination/port/protocol rules | `fw_lw_enable_x`, `filter_lw_default_x/_icmp_x/_date_x/_time_x/_time2_x`, `filter_lwlist` (ascii) → `restart_firewall` (excluded: firewall) |

**› Inbound Access & NAT**

| # | Page | What it does | Backing data / write path |
| --- | --- | --- | --- |
| 24 | Port Forwarding | Static inbound port→host mappings, one rule list per WAN unit | `vts_enable_x`, `vts_rulelist` / `vts1_rulelist` (ascii) → `restart_firewall` (excluded: firewall) |
| 25 | Dynamic Port Opening (Port Trigger) | Outbound-connection-triggered temporary inbound openings | `autofw_enable_x`, `autofw_rulelist` (ascii) → `restart_firewall` (excluded: firewall) |
| 26 | Fully Exposed Host (DMZ) | One LAN host exposed to all unsolicited inbound traffic (enable state is derived from the address being non-blank) | `dmz_ip`, `dmz1_ip`, `sp_battle_ips` (read-only) → `restart_firewall` (excluded: firewall) |
| 27 | Protocol Passthrough (VPN / SIP / RTSP) | NAT helper toggles for PPTP, L2TP, IPSec, RTSP, H.323, SIP; PPPoE relay; FTP ALG port | `fw_pt_*`, `pppoerelay_unit`, `vts_ftpport` → `restart_firewall;restart_pppoe_relay` (excluded: firewall) |

**› Content & Device Restrictions**

| # | Page | What it does | Backing data / write path |
| --- | --- | --- | --- |
| 28 | Threat & Intrusion Blocking | Malicious-site blocking, two-way intrusion prevention, infected-device (C&C) blocking; requires vendor EULA acceptance | `wrs_protect_enable/_mals_enable/_vp_enable/_cc_enable`, EULA gate on `TM_EULA` → `restart_wrs;restart_firewall` (excluded: firewall) |
| 29 | Per-Device Schedules & Blocking | Per-client outright block or weekly allowed-time schedule | `MULTIFILTER_ALL/_ENABLE/_MAC/_MACFILTER_DAYTIME_V2`, `MULTIFILTER_DEVICENAME` (ascii) → `restart_firewall` (excluded: firewall) |
| 30 | DNS Redirection & Filtering | Global and per-client forced DNS resolver, including filtering-service presets and three user-defined resolver pairs | `dnsfilter_enable_x/_mode/_custom{1,2,3}/_custom6{1,2,3}`, `dnsfilter_rulelist` + `…1-5` shards (ascii) → `restart_dnsfilter` |
| 31 | Website Address Blocking | Keyword match against requested URLs, black or white list | `url_enable_x`, `url_mode_x`, `url_rulelist` (ascii) → `restart_firewall` (excluded: firewall) |
| 32 | Page Keyword Blocking | Blocks pages whose content matches listed keywords | `keyword_enable_x`, `keyword_rulelist` (ascii) → `restart_firewall` (excluded: firewall) |

### 6. VPN

*Sub-headers — 9 pages.*

**› Overview**

| # | Page | What it does | Backing data / write path |
| --- | --- | --- | --- |
| 33 | Connection Status | Live state of every OpenVPN server/client unit, WireGuard client unit and the PPTP daemon, with tunnel and exit IPs | `/ajax_vpn_status.asp` scalars + `vpn_client{n}_desc` / `wgc{n}_desc` (ascii). Read-only |

**› Outgoing Connections (router as client)**

| # | Page | What it does | Backing data / write path |
| --- | --- | --- | --- |
| 34 | OpenVPN Client | Per-unit remote server, transport, auth, ciphers, redirect-gateway/DNS handling, custom config | `vpn_client{p}_*` family → `restart_vpnclient{p}` (excluded: vpn) |
| 35 | WireGuard Client | Per-unit interface address, keys, peer endpoint, allowed IPs, keepalive, kill switch | `wgc{p}_*` family → `restart_wgc` (excluded: vpn) |
| 36 | VPN Provider Profiles (read-only) | Lists the multi-profile client manager's stored profiles (description, protocol, target unit, enable state) | `vpnc_clientlist`, `vpnc_pptp_options_x_list` (ascii). Read-only by design — the stored encoding packs protocol-dependent fields into shared columns |
| 37 | VPN Routing Rules | Which local/remote address ranges leave through which VPN client interface (or the plain WAN) | `vpndirector_rulelist` (ascii) → `restart_vpnrouting0` (excluded: vpn) |

**› Incoming Connections (router as server)**

| # | Page | What it does | Backing data / write path |
| --- | --- | --- | --- |
| 38 | OpenVPN Server | Per-instance interface/protocol/port, tunnel subnet, client access rules, cipher and auth settings | `vpn_serverx_start` (membership = enable), `vpn_server{p}_*`, `vpn_server{p}_ccd_val` (ascii) → `restart_vpnserver{p}` (excluded: vpn) |
| 39 | WireGuard Server | Listen port, server keys, tunnel address, DNS, NAT6, keepalive, PSK | `wgs1_*` (single instance on this hardware) → `restart_wgs;restart_dnsmasq` (excluded: vpn) |
| 40 | PPTP Server | Enable, broadcast support, client address range, MPPE encryption levels, per-user accounts | `pptpd_enable/_broadcast/_clients/_mppe`, `pptpd_clientlist` (ascii) → `restart_pptpd` (excluded: vpn) |
| 41 | IPsec Server | Enable, pre-shared key, virtual client subnet, DPD, pushed DNS/WINS, per-user accounts split by IKE version | `ipsec_server_enable`, `ipsec_profile_1` (38-field packed string, 5 editable positions), `ipsec_client_list_1/_2` (excluded: vpn) |

### 7. Traffic & Bandwidth

*Sub-headers — 9 pages.*

**› Usage Monitoring**

| # | Page | What it does | Backing data / write path |
| --- | --- | --- | --- |
| 42 | Live Throughput | Rolling real-time in/out rates | live traffic feed. Read-only |
| 43 | Last 24 Hours | Hourly in/out totals for the past day | traffic history feed. Read-only |
| 44 | Daily Usage | Per-day totals from the stored history | daily history feed. Read-only |
| 45 | Monthly Usage | Per-month totals from the stored history | monthly history feed. Read-only |
| 46 | History Recording Settings | Whether history is kept, where it is saved, save frequency, monthly cycle start day, backups, excluded interfaces | `rstats_enable/_path/_stime/_offset/_bak/_exclude` → `restart_rstats` |

**› Prioritization & Limits**

| # | Page | What it does | Backing data / write path |
| --- | --- | --- | --- |
| 47 | Prioritization Setup | Master enable, prioritization engine choice, up/down bandwidth, WAN link-layer overhead; vendor EULA gate on the DPI-based engine | `qos_enable/_type/_obw/_ibw/_overhead/_atm/_mpu`, EULA gate on `TM_EULA` → `restart_qos;restart_firewall` |
| 48 | Priority Rules | Match-by-IP/MAC/port/protocol rules with a priority tier, plus the default tier for unmatched traffic | `qos_default`, `qos_rulelist` (ascii) → `restart_qos;restart_firewall` |
| 49 | Per-Device Speed Limits | Per-client download/upload caps and rank | `qos_bw_rulelist` → `restart_qos;restart_firewall` |
| 50 | Live Priority Statistics | Per-class byte totals, rate and packets/s, download and upload | `ajax_gettcdata.asp` class arrays + `qos_enable`/`qos_type`. Read-only |

### 8. USB Storage & Sharing

*Flat — 4 pages.*

| # | Page | What it does | Backing data / write path |
| --- | --- | --- | --- |
| 51 | Windows File Sharing (SMB) | Service enable, device/workgroup name, SMB protocol version, naming and browser/WINS behaviour, user limit, NTFS sparse files | `enable_samba`, `computer_name`, `st_samba_workgroup`, `smbd_*`, `st_max_user`, `usb_fs_ntfs_sparse` → `restart_ftpsamba;restart_dnsmasq` |
| 52 | FTP File Sharing | Service enable, WAN access, TLS, user limit, codepage | `enable_ftp`, `ftp_wanac`, `ftp_tls`, `st_max_user`, `ftp_lang` → `restart_ftpsamba` |
| 53 | NFS File Sharing | NFSD enable, legacy v2 support, exported paths with access list and options | `nfsd_enable`, `nfsd_enable_v2`, `nfsd_exportlist` (ascii) → `restart_nasapps` |
| 54 | Media Streaming (DLNA & iTunes) | DAAP and DLNA server enable and names, database rebuild, status page, shared directory list with content types | `daapd_*`, `dms_*`, `dms_dir_x`/`dms_dir_type_x` (ascii) → `restart_media` |

### 9. Live Status & Logs

*Flat — 7 pages. All read-only.*

| # | Page | What it does | Backing data |
| --- | --- | --- | --- |
| 55 | System Log | Full syslog with line filter and download | syslog feed |
| 56 | Wireless Status Log | Current per-interface wireless status/station arrays as reported by the firmware | wireless status hook |
| 57 | Active DHCP Leases | Hostname, MAC, IP, remaining lease | DHCP lease feed |
| 58 | IPv6 Status | Current IPv6 configuration plus IPv6 LAN clients | IPv6 status feed |
| 59 | Routing Table | IPv4 and IPv6 kernel routes with flags, metric, interface | route feed |
| 60 | Active Port Forwards | Live NAT forward chain entries plus UPnP / NAT-PMP leases | vserver + UPnP feeds |
| 61 | Active Connections | Live conntrack table with filter | connection feed |

### 10. Network Diagnostics

*Flat — 3 pages. Every page here requires an explicit user action to run.*

| # | Page | What it does | Backing data / write path |
| --- | --- | --- | --- |
| 62 | Ping, Traceroute & DNS Lookup | Runs the chosen probe on the router itself, IPv4 or IPv6, and streams output | `netool.cgi` start + poll. No nvram write |
| 63 | Open Sockets & NAT Table | Runs netstat or netstat-NAT on the router and streams output | `netool.cgi` start + poll. No nvram write |
| 64 | Wake a Device (Wake-on-LAN) | Sends a magic packet to a typed or saved MAC; edits the saved target list | `wollist` (ascii) write; wake action posts `SystemCmd=ether-wake …` through the write guard |

### 11. Administration

*Sub-headers — 7 pages.*

**› Router Access**

| # | Page | What it does | Backing data / write path |
| --- | --- | --- | --- |
| 65 | Web Interface & Remote Access | HTTP/HTTPS mode and ports, WAN admin access, login captcha and idle logout, IP access restriction list, telnet, USB drive spin-down, NAT redirect notice, scheduled reboot | `http_enable/_lanport`, `https_lanport`, `misc_http*_x`, `captcha_enable`, `http_autologout`, `enable_acc_restriction` + `restrict_rulelist` (ascii), `telnetd_enable`, `usb_idle_*`, `nat_redirect_enable`, `reboot_schedule*` → `restart_time;restart_httpd;restart_upnp` |
| 66 | Command-Line Access (SSH) | SSH enable scope, port forwarding, port, password login, authorized keys | `sshd_enable/_forwarding/_port/_pass/_authkeys` → `restart_time;restart_httpd;restart_upnp` |

**› System Settings**

| # | Page | What it does | Backing data / write path |
| --- | --- | --- | --- |
| 67 | Clock & Time Servers | Time zone, primary/secondary NTP servers, local NTP server and client interception | `time_zone`, `ntp_server0/1`, `ntpd_enable`, `ntpd_server_redir` → `restart_time` |
| 68 | Advanced System Tuning | Connection-tracking table size and per-state TCP/UDP timeouts, plus four miscellaneous service toggles | `ct_max`, `ct_tcp_timeout`, `ct_udp_timeout` (both decomposed), `http_dut_redir`, `ipv6_ns_drop`, `aae_disable_force`, `dhcpd_send_wpad` → `restart_conntrack` (the only live-verified write path in the build) |

**› Maintenance**

| # | Page | What it does | Backing data / write path |
| --- | --- | --- | --- |
| 69 | Firmware Version | Current version components and the result of the last online update check | `firmver`, `buildno`, `extendno`, `webs_state_info/_flag`. Read-only by design |
| 70 | Backup & Restore Settings | Explains that factory reset, settings file save/upload and JFFS backup are file/reboot actions not modelled here; shows whether the JFFS partition is mounted | `jffs2_on`. Read-only by design |
| 71 | Security Update History | Explains that the native view is a raw log-file dump not reachable through this build's nvram-only read primitives | No nvram keys. Informational only |

### 12. Merlin's Cloak

*Flat — 2 pages. Nothing here touches the router's configuration.*

| # | Page | What it does |
| --- | --- | --- |
| 72 | Detection & Write Log | Detected router identity, live capability flags, per-page read/write confidence, and the log of every write the extension has constructed (including dry-runs) |
| 73 | Extension Settings | Read-only-mode interlock and the configured router address |

---

## 3. Full rename map

Every category and page whose name changes. "Current name" is what this
extension renders today — nav label first, with the page title in parentheses
where the two differ. Rows marked *(unchanged)* are listed at the end for
completeness and need no tooltip.

### Categories

| Current name | Proposed name |
| --- | --- |
| Network Map | Overview |
| Guest Network Pro | *dissolved* → Local Network › Segments & Ports |
| AiProtection | *dissolved* → Security & Access Control › Content & Device Restrictions |
| Parental Controls | *dissolved* → Security & Access Control › Content & Device Restrictions |
| QoS | *merged* → Traffic & Bandwidth › Prioritization & Limits |
| Traffic Analyzer | *merged* → Traffic & Bandwidth › Usage Monitoring |
| USB Applications | USB Storage & Sharing |
| LAN | Local Network |
| WAN | Internet Connection |
| IPv6 | *dissolved* → Internet Connection |
| Firewall | Security & Access Control |
| DNS Director | *dissolved* → Security & Access Control › Content & Device Restrictions |
| System Log | Live Status & Logs |
| Network Tools | Network Diagnostics |
| Wireless | *(unchanged)* |
| VPN | *(unchanged)* |
| Administration | *(unchanged)* |
| Merlin's Cloak | *(unchanged — the extension's own name, not a router-vendor product name)* |

### Pages

| Current name (page title if different) | Current category | Proposed name | Proposed placement |
| --- | --- | --- | --- |
| Network Map | Network Map | Router Status | Overview |
| Clients | Network Map | Connected Devices | Overview |
| System Information | Network Tools | Router Resources | Overview |
| General | Wireless | Wi-Fi Name & Security | Wireless › Radio & Network |
| Professional | Wireless | Advanced Radio Settings | Wireless › Radio & Network |
| Bridge / WDS | Wireless | Wireless Bridging (WDS) | Wireless › Radio & Network |
| Site Survey | Wireless | Nearby Wi-Fi Scan | Wireless › Radio & Network |
| MAC Filter (Wireless MAC Filter) | Wireless | Device Allow/Block List | Wireless › Client Access |
| WPS | Wireless | Push-Button Pairing (WPS) | Wireless › Client Access |
| RADIUS (RADIUS Settings) | Wireless | Enterprise Authentication (RADIUS) | Wireless › Client Access |
| LAN IP | LAN | Router Address & Hostname | Local Network › Addressing & Routing |
| DHCP Server | LAN | Address Assignment (DHCP) | Local Network › Addressing & Routing |
| Route | LAN | Static Routes | Local Network › Addressing & Routing |
| Guest Network Pro | Guest Network Pro | Separate Networks & Guest Wi-Fi | Local Network › Segments & Ports |
| IPTV | LAN | IPTV & Multicast | Local Network › Segments & Ports |
| Switch Control | LAN | Ethernet Port Settings | Local Network › Segments & Ports |
| Internet Connection | WAN | Internet Setup | Internet Connection |
| Dual WAN | WAN | Second Connection & Failover | Internet Connection |
| IPv6 | IPv6 | IPv6 Setup | Internet Connection |
| DDNS | WAN | Dynamic Hostname (DDNS) | Internet Connection |
| General | Firewall | Firewall Basics & Inbound Rules | Security & Access Control › Firewall |
| Network Services Filter | Firewall | Outbound Traffic Rules | Security & Access Control › Firewall |
| Port Trigger | WAN | Dynamic Port Opening (Port Trigger) | Security & Access Control › Inbound Access & NAT |
| DMZ | WAN | Fully Exposed Host (DMZ) | Security & Access Control › Inbound Access & NAT |
| NAT Passthrough | WAN | Protocol Passthrough (VPN / SIP / RTSP) | Security & Access Control › Inbound Access & NAT |
| AiProtection | AiProtection | Threat & Intrusion Blocking | Security & Access Control › Content & Device Restrictions |
| Time Scheduling (Parental Controls — Time Scheduling) | Parental Controls | Per-Device Schedules & Blocking | Security & Access Control › Content & Device Restrictions |
| DNS Director | DNS Director | DNS Redirection & Filtering | Security & Access Control › Content & Device Restrictions |
| URL Filter | Firewall | Website Address Blocking | Security & Access Control › Content & Device Restrictions |
| Keyword Filter | Firewall | Page Keyword Blocking | Security & Access Control › Content & Device Restrictions |
| Status (VPN Status) | VPN | Connection Status | VPN › Overview |
| VPN Fusion | VPN | VPN Provider Profiles (read-only) | VPN › Outgoing Connections |
| VPN Director | VPN | VPN Routing Rules | VPN › Outgoing Connections |
| PPTP VPN Server | VPN | PPTP Server | VPN › Incoming Connections |
| IPSec VPN Server | VPN | IPsec Server | VPN › Incoming Connections |
| Real-time (Real-time Traffic) | Traffic Analyzer | Live Throughput | Traffic & Bandwidth › Usage Monitoring |
| Daily (Daily Traffic) | Traffic Analyzer | Daily Usage | Traffic & Bandwidth › Usage Monitoring |
| Monthly (Monthly Traffic) | Traffic Analyzer | Monthly Usage | Traffic & Bandwidth › Usage Monitoring |
| Settings (Traffic Monitoring Settings) | Traffic Analyzer | History Recording Settings | Traffic & Bandwidth › Usage Monitoring |
| QoS | QoS | Prioritization Setup | Traffic & Bandwidth › Prioritization & Limits |
| Rules (Traditional) (QoS Rules (Traditional)) | QoS | Priority Rules | Traffic & Bandwidth › Prioritization & Limits |
| Bandwidth Limiter | QoS | Per-Device Speed Limits | Traffic & Bandwidth › Prioritization & Limits |
| Classification | QoS | Live Priority Statistics | Traffic & Bandwidth › Prioritization & Limits |
| Samba (Network Place (Samba)) | USB Applications | Windows File Sharing (SMB) | USB Storage & Sharing |
| FTP (FTP Share) | USB Applications | FTP File Sharing | USB Storage & Sharing |
| NFS Exports | USB Applications | NFS File Sharing | USB Storage & Sharing |
| Media Server | USB Applications | Media Streaming (DLNA & iTunes) | USB Storage & Sharing |
| General Log | System Log | System Log | Live Status & Logs |
| Wireless Log | System Log | Wireless Status Log | Live Status & Logs |
| DHCP Leases | System Log | Active DHCP Leases | Live Status & Logs |
| IPv6 | System Log | IPv6 Status | Live Status & Logs |
| Port Forwarding | System Log | Active Port Forwards | Live Status & Logs |
| Connections | System Log | Active Connections | Live Status & Logs |
| Network Analysis | Network Tools | Ping, Traceroute & DNS Lookup | Network Diagnostics |
| Netstat | Network Tools | Open Sockets & NAT Table | Network Diagnostics |
| Wake on LAN | Network Tools | Wake a Device (Wake-on-LAN) | Network Diagnostics |
| System | Administration | Web Interface & Remote Access | Administration › Router Access |
| SSH | Administration | Command-Line Access (SSH) | Administration › Router Access |
| Time / NTP | Administration | Clock & Time Servers | Administration › System Settings |
| Tweaks | Administration | Advanced System Tuning | Administration › System Settings |
| Firmware | Administration | Firmware Version | Administration › Maintenance |
| Backup / Restore | Administration | Backup & Restore Settings | Administration › Maintenance |
| Security Notifications | Administration | Security Update History | Administration › Maintenance |
| Diagnostics | Merlin's Cloak | Detection & Write Log | Merlin's Cloak |
| Settings | Merlin's Cloak | Extension Settings | Merlin's Cloak |

**Names deliberately unchanged (8 pages — no tooltip needed):** Port Forwarding
(WAN → Security › Inbound Access & NAT), IPv6 Firewall (Firewall → Security ›
Firewall), OpenVPN Client, WireGuard Client, OpenVPN Server, WireGuard Server,
Routing Table, Last 24 Hours. These are either already plain-language or are
protocol names rather than vendor product names; only their category changes.

**Two current names collide across categories** and are disambiguated by the
rename: "General" existed under both Wireless and Firewall (now *Wi-Fi Name &
Security* and *Firewall Basics & Inbound Rules*), "IPv6" existed as both a
settings page and a log page (now *IPv6 Setup* and *IPv6 Status*), "Port
Forwarding" existed as both a settings page and a log page (now *Port
Forwarding* and *Active Port Forwards*), and "Settings" existed under both
Traffic Analyzer and Merlin's Cloak (now *History Recording Settings* and
*Extension Settings*). The old-name tooltip for these must therefore carry the
old **category** as well as the old name, or it will be ambiguous.

---

## 4. Ambiguous placements

Twelve pages could reasonably sit in more than one place. Each is listed with
the real tension and the reason for the choice made.

**1. Separate Networks & Guest Wi-Fi** — *Local Network › Segments & Ports* vs
*Wireless*.
Tension: the page's most visible attribute is an SSID, which reads as Wireless.
Chosen Local Network because what the record set actually describes is a network
segment: `sdn_rl` carries VLAN index, subnet index, firewall index and captive-
portal index, and `subnet_rl` carries the address, netmask and DHCP range. The
SSID is one attribute of the segment, not its definition. A user hunting for
"which networks exist on this router and what addresses do they use" looks under
Local Network; a user hunting for radio settings does not find them here anyway,
because this page cannot edit them.

**2. Port Forwarding, Dynamic Port Opening, Fully Exposed Host** — *Security &
Access Control › Inbound Access & NAT* vs *Internet Connection*.
Tension: all three are per-WAN-unit concepts today (Port Forwarding literally
keeps a separate `vts1_rulelist` for the secondary WAN) and the vendor UI files
them under WAN. Chosen Security because their function is deciding what
unsolicited inbound traffic is permitted to reach a LAN host — the same question
the firewall pages answer, applied through the same `restart_firewall` write
path. Leaving them under Internet Connection would split inbound policy across
two categories, which is the exact failure the current structure has.

**3. Protocol Passthrough (VPN / SIP / RTSP)** — *Security › Inbound Access &
NAT* vs *VPN*.
Tension: five of its eight toggles are VPN protocols (PPTP, L2TP, IPSec), so a
user configuring a VPN passthrough scenario may look under VPN. Chosen Security
because the toggles do not configure any VPN on this router — they enable NAT
helper modules that let *other* devices' sessions traverse it, alongside the
RTSP/H.323/SIP helpers and the FTP ALG port, which are not VPN at all. The
common thread is NAT traversal, not VPN.

**4. IPv6 Setup** — *Internet Connection* vs *Local Network*.
Tension: roughly half the page's fields are LAN-side (`ipv6_rtr_addr`,
`ipv6_prefix`, `ipv6_dhcp_start/_end`, `ipv6_radvd`, `ipv6_autoconf_type`).
Chosen Internet Connection because the page is gated end to end on
`ipv6_service` — the IPv6 uplink type — and every LAN-side field is conditionally
shown based on it. Splitting it is not an option: it is one page. Note that this
places IPv6 addressing away from IPv4 addressing, which is the cost of the
choice; the alternative places the IPv6 uplink away from the IPv4 uplink, which
is worse, because "how do I get IPv6 from my ISP" is the question that brings
users here.

**5. Router Resources** (current *System Information*) — *Overview* vs *Network
Diagnostics*.
Tension: it is a Merlin "Tools" page and reads like a diagnostic. Chosen
Overview on a consistent criterion: everything in Network Diagnostics requires
the user to press a button to make something happen (run a probe, run netstat,
send a magic packet), whereas Router Resources is a passive auto-refreshing
status readout, exactly like Router Status and Connected Devices.

**6. Wake a Device (Wake-on-LAN)** — *Network Diagnostics* vs *Overview /
Connected Devices*.
Tension: it operates on a LAN device and its saved list is a device list, which
argues for sitting beside Connected Devices. Chosen Network Diagnostics under
the same button-press criterion as above, and because it is the only page in the
build that constructs a `SystemCmd` request — grouping it with the other
router-executes-something pages keeps that class visible in one place.

**7. Active DHCP Leases** — *Live Status & Logs* vs *Local Network › Addressing
& Routing*.
Tension: it is the observed counterpart of the DHCP server page and would be
useful directly beneath it. Chosen Live Status & Logs to keep one consistent
rule for the whole build: configuration pages live with their feature, read-only
live tables live together. Splitting live tables between "next to their setting"
and "in the log section" would leave Active Connections and the Routing Table
stranded, since they have no settings page to sit beside.

**8. Active Port Forwards** — *Live Status & Logs* vs *Security › Inbound Access
& NAT*.
Same tension and same resolution as (7). Additionally, this page shows UPnP /
NAT-PMP leases, which have no configuration page in this build at all, so it is
not purely the observed half of Port Forwarding.

**9. Live Priority Statistics** (current *Classification*) — *Traffic &
Bandwidth › Prioritization & Limits* vs *› Usage Monitoring*.
Tension: it is a monitoring view, which is literally the other sub-header's name.
Chosen Prioritization & Limits because what it monitors is only meaningful once
prioritization is configured — it reports per-class byte counts and shows an
explicit "QoS is disabled" state otherwise. It is the feedback loop for the three
pages above it, not general usage monitoring.

**10. Per-Device Speed Limits** (current *Bandwidth Limiter*) — *Traffic &
Bandwidth › Prioritization & Limits* vs *Security › Content & Device
Restrictions*.
Tension: "cap this device's speed" is a per-device restriction, sitting close to
per-device schedules and blocking. Chosen Traffic & Bandwidth because it is one
of the prioritization engine's modes — the page only takes effect when
Prioritization Setup's type is set to Bandwidth Limiter, and it writes through
the same `restart_qos` path. Placing it under Security would hide that
dependency.

**11. Security Update History** (current *Security Notifications*) —
*Administration › Maintenance* vs *Live Status & Logs*.
Tension: the native page is a log viewer, so Live Status & Logs is the literal
fit. Chosen Administration › Maintenance because this build cannot read that log
(it is a raw file dump, not an nvram key), so the page is informational text
about firmware/package update history — which belongs beside Firmware Version.
Filing an unreadable log under the log section would misrepresent what the user
gets when they click it.

**12. Advanced System Tuning** (current *Tweaks*) — *Administration › System
Settings* vs *Traffic & Bandwidth* / *Security*.
Tension: it is a genuine grab-bag. Its bulk is connection-tracking table sizing
and timeouts (arguably traffic), and it also carries an IPv6 neighbour-
solicitation drop toggle (arguably firewall) and a DHCP WPAD toggle (arguably
Local Network). Chosen Administration › System Settings because no single one of
those claims a majority, and every field is low-level router-daemon tuning rather
than a user-facing feature. See §5 for the underlying problem this exposes.

**Also considered and resolved without a flag:** Wi-Fi *Device Allow/Block List*
stays in Wireless rather than Security because it is per-band and lives in the
`wl{p}_` family; *Nearby Wi-Fi Scan* stays in Wireless rather than Network
Diagnostics because its output is only actionable when picking a channel on the
adjacent page; *Connection Status* stays in VPN rather than Overview because
Overview is about the router and its clients, not about one feature's state.

---

## 5. Anything not addressed

All 73 registered views are placed. Nothing was left uncategorised. What follows
is the residue a categorisation pass cannot fix.

**1. Two pages are internally heterogeneous, and no category placement is right
for all of their sections.**
*Web Interface & Remote Access* (current *System*) mixes admin-UI access control,
telnet, USB hard-drive spin-down timing, a NAT redirection notice, and scheduled
reboot — because the native firmware ships them as one form and this build
faithfully mirrors that. USB spin-down belongs with USB Storage & Sharing and
scheduled reboot belongs with Maintenance, but neither can move without splitting
the page, which is an implementation decision beyond a taxonomy proposal.
*Advanced System Tuning* (current *Tweaks*) has the same problem, described in
§4.12. Both are placed by centre of gravity, not by fit.

**2. Sub-header uniformity in VPN.**
The VPN › Overview sub-header holds exactly one page. It is kept because
Connection Status reports on both client and server instances and therefore
cannot honestly sit under either direction-specific sub-header, and demoting it
to an ungrouped first item would require a nav model that supports both grouped
and ungrouped children within one category. That is an implementation constraint
this document does not decide.

**3. Category gating changes as a side effect of consolidation, and this is not
modelled here.**
Four of the five dissolved orphan categories carried their own capability gate
(`mtlancfg_support` for Guest Network Pro, `bwdpi_support` for AiProtection,
`dnsfilter_support` for DNS Director, `ipv6` for IPv6). Today those gates hide a
whole category; after consolidation the gate must move to the page and the parent
category must survive on its remaining pages. The page-level gates already exist
in the definitions, so nothing is lost — but the nav model's per-group `gate`
entries would need reworking, and a category whose every page is gated off must
still hide itself. Flagged, not designed.

**4. Two names remain jargon rather than plain language, deliberately.**
"WDS", "WPS", "RADIUS", "DMZ", "DHCP", "NFS", "SMB", "DDNS", "IPsec", "OpenVPN"
and "WireGuard" are retained as parenthetical qualifiers or as protocol names,
because they are standards and product-neutral identifiers rather than the
router vendor's marketing terms, and removing them would make the pages harder
to find, not easier. Every one is preceded by a plain-language description of
what it does. If the intent is to eliminate acronyms entirely, that is a further
pass and would need a decision on each.

**5. No verification of the proposed names against the live UI.**
Names were chosen from what each page's fields and write paths actually do. They
have not been checked for width or truncation in the existing nav rendering, and
several are longer than the names they replace (e.g. "Protocol Passthrough
(VPN / SIP / RTSP)" vs "NAT Passthrough"). A layout pass is needed before
implementation.
