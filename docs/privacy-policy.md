---
title: Merlin's Cloak v2 — Privacy Policy
---

# Privacy Policy — Merlin's Cloak v2

**Effective:** 2026-08-01

Merlin's Cloak v2 is a browser extension that replaces the web interface of
an Asuswrt-Merlin router with a client-side re-theme. This policy describes,
in full, what the extension does and does not do with data. There is no
separate, longer version of this policy — this is the whole thing.

## The short version

The extension talks only to the router address you configure. It has no
server of its own, contacts no third party, and does not know you exist.

## What the extension can see

- **Router status and configuration values** (nvram entries, log lines,
  client lists, traffic counters, and similar) — read from your router using
  the browser session you are already authenticated with, exactly as the
  router's native web UI would read them.
- **Settings you choose to submit** — when you use a settings page and click
  Apply, the extension constructs the same kind of request the router's own
  native page would send, and sends it directly to your router. This can
  include fields the router itself defines as sensitive, such as a Wi-Fi
  passphrase or a VPN pre-shared key — the extension is a UI for entering
  values the native firmware page would otherwise collect the same way. That
  value passes through the extension's memory only in the course of
  submitting the form you filled in; it is not logged, stored, or sent
  anywhere else.

## What the extension stores

Three settings, in the browser's local extension storage (`chrome.storage`),
and nothing else:

- the router address you've configured,
- whether read-only mode is on (it defaults to on), and
- whether the extension is enabled (it defaults to on; turning it off
  restores the router's native web UI).

Nothing else persists. There is no history, no cache of values you've
viewed, no record of past writes beyond what the browser's own Diagnostics
panel shows for the current session (and that panel's log is in-memory and
disappears on close).

## What the extension never does

- No analytics, telemetry, crash reporting, or usage tracking of any kind.
- No calls to any host other than the router address you configured. There
  is no update-check server, no remote config, no third-party API of any
  kind — same-origin requests to your router are the only network traffic
  the extension generates.
- No collection of your router credentials. The extension relies on the
  authenticated session your browser already has with the router; it never
  sees, stores, or transmits your login password.
- No sale, sharing, or transfer of any data to anyone, for any purpose.

## Permissions, and why each one exists

- **`storage`** — holds the three settings listed above.
- **`scripting`** — used only against the router origin you've configured,
  for two purposes: registering the extension's interface on a custom
  (non-default) router address after you've explicitly granted it, and
  reading firmware capability flags that Manifest V3's isolated-world
  content scripts cannot otherwise see.
- **Host permissions** — the extension is pre-registered for the router's
  common default addresses (`192.168.1.1` and the two Asuswrt-Merlin DNS
  names) so it works immediately without a setup step. For any other
  address, it requests permission for that one specific origin only, at the
  moment you save it, and only if it's a private-network address (RFC1918,
  loopback, or a `.local` name) — it is not able to request, and will not
  request, permission for any public internet host.

## Children's privacy

The extension is a router-administration tool and is not directed at, or
knowingly used by, children.

## Changes to this policy

If this policy ever changes, the updated version will be published at this
same URL with a new effective date, and noted in the project's
[CHANGELOG](https://github.com/StarlightDaemon/merlins_cloak_v2/blob/main/CHANGELOG.md).

## Contact

Questions about this policy or the extension's data handling can be filed as
an issue at
[github.com/StarlightDaemon/merlins_cloak_v2/issues](https://github.com/StarlightDaemon/merlins_cloak_v2/issues).

## Not affiliated with ASUS

Merlin's Cloak v2 is an independent, unofficial project. It is not produced,
endorsed, or supported by ASUSTeK Computer Inc. or the Asuswrt-Merlin
project.
