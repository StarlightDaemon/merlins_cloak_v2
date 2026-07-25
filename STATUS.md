# Build Status — Merlin's Cloak v2

Session of 2026-07-24 (resumed once after a mid-session usage-limit
interruption; no disk work lost). This document is the resumable state of
record. See git log for the commit trail.

## Snapshot

- **73 views registered** (50 declarative settings pages, 23 custom React
  pages) covering **67 distinct native .asp pages**; 14 Merlin-only views.
- **46 settings-page write paths implemented** (plus WOL wake and Site Survey
  rescan actions) — **none live-submitted this session**, all routed through
  the write-guard with the read-only interlock shipping ON.
- Lint clean; **Chrome (MV3) and Firefox builds both pass**.
- **Live verification NOT yet performed** — the operator had not loaded the
  built extension into the paired browser during this session ("build first,
  verify later"). Every page's read path is therefore either
  'live-verified' (the native page was exercised during the earlier probe
  sessions and our replacement reads the same endpoints) or 'structural'.
  The Diagnostics → Page confidence view is the authoritative per-page table.

## What exists (by category)

| Category | Views | Notes |
|---|---|---|
| Status | Dashboard, Clients | uptime via `uptime()` hook; clients = leases + get_wclientlist |
| Guest Network Pro | SDN overview | read-only by design; profile editing deferred |
| AiProtection | 1 | TM_EULA gate enforced (versioned values handled) |
| Parental | 1 | 4 parallel MULTIFILTER_* lists recomposed; V2 daytime tokens decoded |
| QoS | Settings, Rules, Limiter, Classification | Cake = qos_type 9; Mb↔Kb conversion mirrors native |
| Traffic | Realtime, Last24, Daily, Monthly, Settings | update.cgi hex-literal JS parsed properly |
| Wireless | General, WPS, WDS, MAC filter, RADIUS, Professional, Site Survey | per-band instance selector (wl0/1/2) |
| LAN | LAN IP, DHCP, Route, IPTV, Switch Control | |
| WAN | Internet, Dual WAN, Port Trigger, Port Forwarding, DMZ, DDNS, NAT Passthrough | wan{p} instance selector |
| IPv6 | 1 | real ipv6_service tokens (dhcp6/other/ipv6pt/flets/6to4/6in4/6rd) |
| VPN | Status, OpenVPN client+server, WireGuard client+server, PPTP, IPSec, VPN Director, VPN Fusion (read-only) | comma-list enables decomposed; IPSec profile positions passed through |
| Firewall | General+IPv4 inbound, URL filter, Keyword filter, Net services filter, IPv6 firewall | IPv6 FW merged into BasicFirewall on 3006 — modeled as own view |
| DNS Director | 1 | 6-way rulelist sharding replicated |
| Administration | System, Time/NTP, SSH, Tweaks, Security notifications, Firmware (view), Backup (view) | |
| System Log | General, Wireless, DHCP leases, IPv6, Routes, Port forwards, Connections | |
| Network Tools | Sysinfo, Analysis, Netstat, WOL | netool.cgi; actions user-initiated only |
| USB | Samba, FTP, Media server, NFS exports | share-permission subsystem out of scope |
| Extension | Diagnostics, Settings | write inspector logs every constructed request |

## Write-path posture (unchanged, load-bearing)

- Endpoint policy: **applyapp.cgi delta writes for every settings page** —
  settled from httpd source (validate_apply iterates router_defaults and sets
  only posted keys; applyapp.cgi and apply.cgi share do_apply_cgi;
  start_apply.htm's whole-form requirement is a client-side artifact of the
  native pages posting stale full forms). start_apply support remains in
  lib/router-io.ts but no def uses it.
- Instance pages post fully-prefixed keys (wl0_ssid, vpn_client1_addr…),
  accepted by validate_instance() — confirmed in web.c.
- Verification: every applied write polls forced-fresh nvram re-reads
  (verifyNvram); response bodies are never trusted.
- Hard-excluded categories are tagged per-def (`writeExclusion`) and shown in
  Diagnostics; the four Tools_OtherSettings fields remain the only
  live-verified writes (from the prior human-supervised session).
- SystemCmd actions (WOL ether-wake) use action_mode ' Refresh ' via the same
  guarded path.

## Known open items / deferred (deliberate)

1. **Live verification pass (both browsers)** — blocked on operator loading
   the unpacked builds (.output/chrome-mv3, .output/firefox-mv2 or -mv3).
2. Wireless band-token question: Advanced_Wireless_Content.asp's own JS posts
   band-role-token field names (2g1_*) via httpApi.nvramSet; our defs post
   canonical wl{N}_* keys, which validate_instance accepts. Confirm live
   before any wireless write is ever cleared.
3. wgs1_* (WireGuard server) direct-prefixed writes: no dedicated
   validate_instance branch was found; leap-of-faith flagged in
   vpn-server.ts.
4. ipsec_profile_2 regeneration is not reproduced (native regenerates it on
   every save); enabling IPSec via this UI won't refresh it.
5. rcService cannot branch enable→restart vs disable→stop (vpn servers,
   ipsec); static restart chosen; harmless for nvram, service state may need
   a follow-up toggle.
6. SDN profile creation/editing; per-user Samba/FTP permissions;
   OpenVPN username/password client list (vpn_serverx_clientlist);
   WireGuard server peers; certificate/key BLOBs; Operation Mode switching;
   Time Machine; Download Master; AiMesh node management; notification
   center; Advanced_QOSUserPrio (per-priority % allocation).
7. Dashboard WAN card shows wan0 only (no dual-WAN aggregation).

## Safety invariants honored

- No write submitted to the live router by the agent, in any category.
- No live verification attempted without operator confirmation; no browser
  profile/cookie/session access of any kind.
- RAW/ untouched; no live household data committed.
