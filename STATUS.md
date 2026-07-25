# Build Status — Merlin's Cloak v2

*(Working draft — finalized at session end. See git log for the commit trail.)*

## Snapshot

Full-parity rebuild session in progress. Foundation + core API + most of the
page catalog authored and committed. Live verification is **pending operator
action** (extension not yet loaded in the paired browser at session start —
operator chose "build first, verify later").

## Done
- Core page-definition API: declarative settings renderer, rule-list editor,
  instance selector ({p} expansion), write-guard with read-only interlock,
  EULA gating, capability detection (228 live flags), diagnostics view.
- Categories authored & committed: LAN (5), WAN (7), Wireless (6+survey),
  Firewall (5), IPv6 (1), VPN client/server/director/status (8), DNS Director,
  Traffic (5), QoS stats, Logs (7), Network tools (3+WOL), USB (4), SDN
  overview, AiProtection, Parental Controls, Clients, Tweaks, Dashboard.

## Pending (this session)
- Admin category agent (System / Time / SSH / firmware view / backup view /
  security notification).
- QoS settings agent (EZQoS, traditional rules, bandwidth limiter).
- Final integration, STATUS finalization.

## Deferred (not started, deliberate)
- IPSec VPN server page (Advanced_VPN_IPSec.asp).
- Operation Mode switching, Time Machine, Download Master, AiMesh node
  management, SDN profile creation/editing (read-only overview shipped),
  per-user Samba/FTP share permissions (aidisk.cgi subsystem), OpenVPN
  username/password client list (flat entangled key), WireGuard server peers
  (wgs1_cN_ families), certificate/key BLOB management.

## Write-path posture
- No write was live-submitted this session. Read-only interlock ships ON.
- Endpoint: applyapp.cgi delta writes everywhere (validate_apply in
  httpd/web.c iterates router_defaults and sets only posted keys; both
  endpoints share do_apply_cgi). start_apply.htm path retained in the write
  layer but unused by current defs.
- Hard-excluded categories per operator scoping are tagged writeExclusion in
  every def and surfaced in Diagnostics → Page confidence.
