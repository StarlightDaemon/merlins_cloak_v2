# Build Status — Merlin's Cloak v2

Session of 2026-07-24 (resumed once after a mid-session usage-limit
interruption; no disk work lost). This document is the resumable state of
record. See git log for the commit trail.

## Session of 2026-07-25 — nav taxonomy implemented, live check blocked

The navigation taxonomy from docs/NAV_TAXONOMY_PROPOSAL.md is fully
implemented (7 code/docs commits: proposal committed, section bands removed,
twelve-category tree with sub-headers, orphan consolidation with page-level
gates kept exactly as they were, full §3 rename sweep, NAV_ALIASES secondary
placements with alias-aware deep-link auto-expand, hover-only prior-name
tooltips, Diagnostics confidence table regrouped). tsc + eslint clean; Chrome
MV3 and Firefox MV3 builds both pass and are current in .output/.

**Live verification (Task 8) did not run.** The paired Chrome's router tab
bounced to Main_Login.asp (no authenticated session — the agent does not
enter credentials), and a console-tracked reload of that page showed no
`[merlins-cloak]` log line, so the extension appears not to be loaded (or
disabled) in that browser right now. To resume: log in to 192.168.1.1, load
or reload the unpacked build from `.output/chrome-mv3` at chrome://extensions,
then re-run the Task 8 checklist (category names/order, sub-headers, the
three aliased pages in both homes, prior-name tooltips incl. one
disambiguation case, gated-page hiding, Diagnostics grouping). Nothing has
been pushed to origin; all commits are local, held for operator review.

## Snapshot

- **73 views registered** (50 declarative settings pages, 23 custom React
  pages) covering **67 distinct native .asp pages**; 14 Merlin-only views.
- **46 settings-page write paths implemented** (plus WOL wake and Site Survey
  rescan actions) — **none live-submitted this session**, all routed through
  the write-guard with the read-only interlock shipping ON.
- Lint clean; **Chrome (MV3) and Firefox builds both pass**.
- **Chrome live verification: DONE** (operator loaded the unpacked build;
  observational pass against the live RT-BE92U). Verified working with live
  data and no console errors: mount/DOM-takeover, identity detection
  (RT-BE92U · 3006.102.7_2 · Merlin · ASUSWRT 5.0), read-only interlock,
  Dashboard, Clients, SDN overview, DHCP settings renderer + rule-list
  editor, General Log (8.7k lines), Realtime traffic (6 interfaces),
  Sysinfo, VPN Status, Tweaks (values match the write-characterization
  baseline exactly), Diagnostics. Capability collection now reports 227
  *_support flags via the MAIN-world scripting-API collector (green chip).
- **Firefox live verification: NOT run** — the operator did not load the
  Firefox build this session; the build itself passes. Single remaining
  verification gap.

### Findings from the live pass (all fixed in-session)
1. Chromium's extension loader rejects Unicode noncharacters in content
   scripts even when byte-valid UTF-8 (U+FFFF sort sentinel → load failure).
2. MV3 inline MAIN-world <script> injection is silently dropped on this
   firmware's pages → flag collection fell back to rc_support (90 flags,
   hiding band6g). Replaced with background scripting.executeScript
   world:'MAIN' (no router traffic from the background).
3. **wl0_ssid holds a 32-hex placeholder on SDN-managed ASUSWRT 5.0** — the
   real broadcast SSID lives in the MAINFH sdn_rl record's apg{idx}_ssid.
   Dashboard now reads it; wireless-general still edits wl-family keys
   (correct for writes per validate_instance, but display/edit semantics on
   SDN units need a supervised write session before any wireless write is
   ever cleared).
4. sysinfo hooks return literal "None" for stopped VPN/pid states, memory
   values pre-scaled in MB, and HTML entities in cpu.model.
5. dnsmasq leases use '*' for unknown hostnames.
6. The content script can be injected twice into one document
   (double-mount observed) — idempotency guard added.
7. Direct address-bar navigation to appGet.cgi bounces to the login page
   (referer-checked); the extension's same-origin XHR reads are unaffected.

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
