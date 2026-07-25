# Changelog

All notable changes to this project are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Nothing has been released yet. `0.9.0-beta.1` is the first version number this
repository has carried beyond the scaffold's placeholder `0.1.0`, so the entry
below covers the whole of the project's history rather than a delta against a
previous release. Dates are the commit dates in this repository.

---

## [0.9.0-beta.1] — 2026-07-25

First versioned pre-release. The feature surface intended for 1.0 is
implemented and the navigation is settled, but two things named in the roadmap
are still open, and both of them are reasons this is not a release candidate:
Firefox has never been loaded against a live router, and 48 of the 49
implemented write paths have never been submitted to one.

### Background — the rebuild decision

v1 of Merlin's Cloak is a userscript
([StarlightDaemon/merlins_cloak](https://github.com/StarlightDaemon/merlins_cloak),
`asus-merlin-ui.user.js`) that re-themes the Asuswrt-Merlin web UI in place. v2
is a ground-up rebuild as a Manifest V3 browser extension on WXT + React,
replacing the native pages rather than restyling them. The only thing carried
across from v1 is the Fujin design token set — `src/theme/fujin-tokens.ts`
still cites the userscript's "FUJIN TOKEN MAP" as its source, and matches
[StarlightDaemon/Fujin](https://github.com/StarlightDaemon/Fujin)'s
`tokens.json` for typography. Everything else is new code.

### Added — scaffold (2026-07-24)

- WXT + React Manifest V3 project targeting Chrome and Firefox, with the Fujin
  tokens carried forward as reference values (`bb02d88`).

### Added — architecture research (2026-07-24)

Five reports landed before the UI work began, and the page catalog's confidence
tiers still cite them directly. They record sessions of source analysis and, in
two cases, live work against the author's own RT-BE92U.

- `docs/STOCK_VS_MERLIN_DIFF.md` — stock ASUSWRT vs Asuswrt-Merlin source
  comparison for the RT-BE92U, including the `menuTree.js` navigation contract
  and Merlin's `web.c` divergence (`12777f5`).
- `docs/LIVE_PROBE_RT-BE92U.md` — read-only live probe answering what source
  analysis could not: live `*_support` flag values, which `menuTree_*.js` is
  actually served, that the six AiCloud pages 404 despite being present in
  source, and that an authenticated same-origin GET works against Merlin's
  patched httpd (`2c919c0`).
- `docs/CROSS_GENERATION_DIFF.md` — RT-AX88U (ASUSWRT 4.0) vs RT-BE92U
  (ASUSWRT 5.0) static source comparison. No RT-AX88U was contacted; the author
  does not own one (`e46c0d0`).
- `docs/WRITE_PATH_CHARACTERIZATION.md` — a narrow human-supervised live write
  session against the RT-BE92U: four fields on `Tools_OtherSettings.asp`, each
  read first, approved individually, submitted by the operator's own click,
  verified, then reverted (`4b3ddcc`). Later extended with live confirmation
  that `applyapp.cgi` applies a true single-field delta without disturbing
  sibling fields (`d208d22`).
- `docs/EXTERNAL_RESEARCH_RECONCILIATION.md` — two independent external
  research passes reconciled against the empirical findings, which is where the
  ROG/GT UI variant was first recorded as a coverage gap (`58a006e`).

### Added — foundation and page build (2026-07-24)

- Foundation: manifest, router I/O layer, the write guard, runtime capability
  detection, the Fujin theme, and the app shell (`08e0982`).
- Core editing primitives — the `<`/`>`-delimited nvram rule-list editor and
  the per-instance selector — plus the LAN category (`ed32e6d`).
- Status and diagnostic views: seven log views, sysinfo, network tools, traffic
  monitor, QoS statistics, VPN status, SDN overview, clients; firewall and IPv6
  categories (`7e4deba`).
- WAN, Wireless, VPN client and server, DNS Director, Site Survey, and WOL
  (`1fe112d`).
- QoS settings/rules/limiter, USB applications, Parental Controls,
  AiProtection, VPN Director, dashboard uptime, EULA-gate hardening
  (`d2e8677`).
- Administration: system, time/NTP, SSH, security notifications, and read-only
  firmware and backup views (`c534713`).
- IPSec VPN server, closing the build at **73 views over 67 distinct native
  `.asp` pages**, 14 of them Merlin-only (`7083f5a`).

### Fixed — Chrome load and live-verification pass (2026-07-24 – 2026-07-25)

- Chromium's extension loader rejects Unicode noncharacters in content scripts
  even when the bytes are valid UTF-8; a U+FFFF sort sentinel was failing the
  load outright (`6463db9`).
- Fixes from the first live Chrome session against the RT-BE92U (`225fdf5`):
  capability flags now collected from the MAIN world via the scripting API
  after MV3 inline injection turned out to be silently dropped on this
  firmware (90 flags via the `rc_support` fallback → 227 live globals); the
  dashboard reads the real broadcast SSID from the SDN `MAINFH` record, since
  `wl0_ssid` holds a 32-hex placeholder on SDN-managed ASUSWRT 5.0; sysinfo
  memory units and HTML entities; literal `"None"` states in VPN status;
  `*` hostnames in dnsmasq leases.
- Guard against the content script mounting twice in one document, observed
  live (`0a1f3d9`).

### Changed — inventory audit (2026-07-25)

A category-by-category audit of the built surface against the native pages,
committed in 18 parts (`af5073d` … `ab0fd5c`), producing
`docs/CURRENT_STATE_AUDIT.md`. It reconciled the headline counts, recorded
Firefox verification status as operator self-report rather than verified, and
fed the taxonomy work that followed.

### Changed — navigation taxonomy (2026-07-25)

`docs/NAV_TAXONOMY_PROPOSAL.md` (`b8e6a42`) and its implementation:

- The three fixed section bands collapsed into one ordered category list
  (`dca3da6`).
- A twelve-category tree with real two-level sub-headers (`68686aa`).
- The five single-page orphan categories dissolved into their neighbours, with
  page-level visibility gates preserved exactly (`cc652a2`).
- A full plain-language rename sweep across every page (`fe9404d`).
- `NAV_ALIASES`: three live-status tables now also appear beside the setting
  they observe, with alias-aware deep-link auto-expand (`76ff32f`).
- Hover-only *Formerly "…"* tooltips so renamed entries stay findable by their
  old names (`fe47817`).
- The Diagnostics confidence table regrouped under the new taxonomy
  (`8591e86`), and one label regression fixed (`646a59d`).
- Verified live in Chrome against the RT-BE92U: all twelve categories and six
  sub-header groups render in order, aliases route correctly from a cold load,
  a gate-off state (`nfsd_support = 0`) was observed hiding NFS File Sharing,
  73 page rows in the confidence table with no duplicates, and a clean console
  across ~23 navigations (`650fcb1`).

### Added — licensing, disclosure, and documentation pass (2026-07-25)

- `docs/LICENSE_AUDIT.md` — audit of `src/` against the stock and Merlin GPL
  source trees under `RAW/`, checking comment blocks, string literals, string
  tables, and identifiers/structure. Result: clean, no copied code (`36ac9cd`).
- `LICENSE` — MIT, with a scope note excluding the `RAW/` reference trees and
  the ASUS/Merlin names this client reuses descriptively (`fc7cbf2`).
- A non-affiliation disclaimer in `README.md` and on the extension's own
  Extension Settings view (`5e28d35`).
- Hardware-compatibility claims rewritten to separate live-verified (RT-BE92U
  only) from structurally sourced (RT-AX88U, never contacted) from untested,
  and to state that ROG/GT models are out of scope rather than merely untested
  (`5e28d35`).
- `docs/GETTING_STARTED.md` — end-user install and configuration
  documentation, with a compatibility matrix generated from the page catalog's
  own confidence data.
- This changelog, and the move off the scaffold's placeholder version.

### Current posture

- 73 views over 67 native pages; 50 declarative settings pages, 23 custom
  React views; 14 Merlin-only.
- Read paths: **43 live-verified** on the RT-BE92U, **30 structural** (never
  exercised against a live router).
- Write paths: 49 implemented. **1 live-verified** — the four
  `Tools_OtherSettings.asp` fields from the supervised write session.
  **48 never submitted** to a live router at all.
- The read-only interlock ships on by default, at two layers
  (`DEFAULT_SETTINGS.readOnlyMode` and the write guard's own module default).
- Every constructed write, including interlocked dry-runs, is recorded in the
  Diagnostics write inspector.

### Known open

- **Firefox live verification has never been run.** The Firefox build passes;
  it has not been loaded against a router.
- **Write-path characterization is outstanding for every hard-excluded
  category** (wireless, WAN, DHCP, VPN, firewall, firmware/reboot/reset, and
  the restricted-misc set). Those pages are permanently tagged
  `unverified-write` until a dedicated human-supervised session clears them.
- Deferred by design: SDN profile editing, per-user Samba/FTP permissions,
  OpenVPN client lists, WireGuard server peers, certificate BLOBs, Operation
  Mode switching, AiMesh node management. See `STATUS.md` for the full list.

[0.9.0-beta.1]: https://github.com/StarlightDaemon/merlins_cloak_v2
