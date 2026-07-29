---
title: Chrome Web Store Listing Draft
---

# Chrome Web Store listing — draft copy

Working draft for the Chrome Web Store Developer Dashboard submission. Not
itself submitted anywhere; copy-paste source when the listing is created.
Keep this in sync with `wxt.config.ts`'s manifest fields and
`privacy-policy.md` — if permissions, data handling, or the extension name
change, this file needs a matching update.

## Store listing tab

**Title** (matches `manifest.name` exactly, to avoid a review mismatch flag)

```
Merlin's Cloak v2
```

**Summary** (132-character limit; 129 used)

```
Modernized, client-side re-theme of the Asuswrt-Merlin router UI. Talks only to your router — no accounts, no cloud, no tracking.
```

**Detailed description**

```
Merlin's Cloak v2 replaces the Asuswrt-Merlin router web UI with a
modernized, client-side interface — same router, same settings, same
authenticated session, different front end. It runs entirely in your
browser against the router you're already logged into; nothing is sent
anywhere else.

WHAT IT COVERS
73 views across every major settings and status category the native UI
exposes — Wireless, LAN, WAN, Firewall, VPN (OpenVPN/WireGuard/PPTP/IPSec),
QoS, USB apps, Parental Controls, AiProtection, DNS Director, SDN/Guest
Network overview, Administration, System Log, Network Tools, and more.

READ-ONLY BY DEFAULT
The extension ships with a read-only interlock switched on. In this mode
you can browse every value the router exposes, but nothing can be written
back until you deliberately turn the interlock off from the extension
popup.

YOUR DATA STAYS ON YOUR NETWORK
Every request the extension makes is a same-origin request to the router
address you configured. There is no analytics, no telemetry, no crash
reporting, no update check, and no server operated by the developer of any
kind. Full detail in the privacy policy linked below.

COMPATIBILITY
Live-verified against an Asuswrt-Merlin RT-BE92U. Structurally implemented
(builds and reads cleanly, not yet confirmed against real hardware) for
other Merlin-firmware models with the same nvram/API surface. Not
affiliated with, endorsed by, or supported by ASUS or the Asuswrt-Merlin
project — see the compatibility notes in the project README for details on
what "live-verified" vs. "structural" means for your specific model.

STATUS
Pre-release (0.9.0-beta.1). Read paths are broadly exercised; write paths
are implemented but largely unverified against live hardware, which is why
the read-only interlock defaults on and why this is a beta rather than a
1.0 release. Source, changelog, and full documentation:
https://github.com/StarlightDaemon/merlins_cloak_v2
```

**Category:** Developer Tools (or Productivity — whichever the dashboard's
current taxonomy maps a router-admin tool to; Developer Tools reads closer
given the target audience).

**Privacy policy URL**

```
https://starlightdaemon.github.io/merlins_cloak_v2/privacy-policy.html
```

## Single purpose description

(Required field the dashboard uses to check that every requested permission
is justified by one stated purpose.)

```
Provide a client-side, re-themed user interface for viewing and configuring
an Asuswrt-Merlin router that the user is already logged into. The
extension does not modify router firmware, does not operate independently
of the user's own authenticated router session, and does not transmit any
data beyond the user's own local network.
```

## Permissions justification

One box per requested permission in the dashboard's Permissions tab.

**`storage`**

```
Stores exactly two values locally via chrome.storage: the router address
the user has configured, and whether the read-only write-interlock is on
(defaults to on). Nothing else is stored — no history, no cache, no
credentials.
```

**`scripting`**

```
Used only against the single router origin the user has configured, for
two purposes: (1) registering the extension's content script dynamically
when the user adds a non-default router address, after that origin has
been explicitly granted; and (2) reading firmware capability flags exposed
as page-global variables on the router's own admin page — required because
Manifest V3 content scripts run in an isolated JS world and cannot see
those globals directly without the scripting API's MAIN-world execution.
```

**`host_permissions`** (static: `192.168.1.1`, `router.asus.com`,
`www.asusrouter.com`, http and https)

```
Pre-registers the extension for the router's common default addresses so
it activates immediately on an out-of-box setup, without requiring a
first-run permission prompt for the common case.
```

**`optional_host_permissions`** (`http://*/*`, `https://*/*`)

```
Declared broadly only because the platform requires optional host
permissions to be a superset of anything ever requested at runtime, and a
router's admin address is user-configured and can be changed to any local
IP. In practice, the extension only ever calls permissions.request() for
one specific origin at a time, triggered by an explicit user action (typing
an address and clicking Save), and only after that address passes a
client-side allowlist restricted to RFC1918 private ranges (10.0.0.0/8,
172.16.0.0/12, 192.168.0.0/16), loopback (127.0.0.0/8), and .local mDNS
names. The extension is architecturally unable to request, or run on, any
public-internet host — see isPrivateRouterHost() in
src/entrypoints/popup/App.tsx.
```

## Data disclosure (Privacy practices tab)

For every category on Chrome's data-disclosure form, the answer is **No,
this item does not collect this type of user data**:

- Personally identifiable information
- Health information
- Financial and payment information
- Authentication information
- Personal communications
- Location
- Web history
- User activity
- Website content

Certifications (all true, all to be checked):

- Does not sell or transfer user data to third parties outside approved use
  cases.
- Does not use or transfer user data for purposes unrelated to the item's
  core functionality.
- Does not use or transfer user data to determine creditworthiness or for
  lending purposes.

**Why "No" is accurate despite the extension handling settings fields the
router itself defines as sensitive** (e.g. a Wi-Fi passphrase or VPN key
entered on a settings page): those values are relayed directly to the
user's own router as part of a request the user explicitly submitted — the
same round trip the native firmware page would make — and are never
retained, logged, or transmitted to the developer or any third party. The
disclosure form asks what the *developer* collects; the answer is nothing,
for every category. `privacy-policy.md` states this explicitly rather than
relying on the form's silence to imply it.

## Assets still needed (not covered by this draft)

- At least one screenshot (1280×800 or 640×400) — needs the extension
  loaded live against a router or a realistic mock, not something this
  document can produce.
- Optional promotional tile images.
- A Chrome Web Store developer account (one-time $5 registration).
