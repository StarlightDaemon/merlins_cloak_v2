# Merlin's Cloak v2

A Manifest V3 browser extension that replaces the Asuswrt-Merlin router web UI
with a client-side React interface, built with WXT and targeting Chrome and
Firefox. It is a rebuild of the original
[userscript](https://github.com/StarlightDaemon/merlins_cloak), which remains
the stable version in the meantime.

The extension runs entirely in the router page's own origin. It reads the same
`appGet.cgi` / `ajax_*.asp` endpoints the native UI reads and writes through
the same `applyapp.cgi` / `start_apply.htm` endpoints the native UI writes,
riding the browser's existing authenticated session. Nothing is sent anywhere
else — see [Data handling](#data-handling).

**Status: pre-release.** 73 views are implemented over 67 native pages. Read
paths are broadly exercised; write paths are implemented but almost entirely
unverified against live hardware, and the read-only interlock ships on by
default. See [Compatibility](#compatibility) for exactly what has and has not
been tested, and [CHANGELOG.md](CHANGELOG.md) for the project history.

---

## Not affiliated with ASUS or Asuswrt-Merlin

**This project is not affiliated with, endorsed by, or sponsored by ASUSTeK
Computer Inc. or the Asuswrt-Merlin project.** It is an independent,
third-party client, developed and maintained separately from both.

Product and feature names that appear in this extension and its documentation
— including ASUSWRT, Asuswrt-Merlin, AiProtection, Guest Network Pro, AiMesh,
AiCloud, Adaptive QoS, DNS Director, VPN Director, Trend Micro, and the
*Formerly "…"* tooltips that map renamed views back to the names the router's
own UI used — are used **descriptively, to identify which router feature a
given view corresponds to**. They are the
property of their respective owners. Their use here is not a claim of
affiliation, endorsement, or sponsorship, and does not imply that either ASUS
or Asuswrt-Merlin has reviewed, approved, or supports this software.

This extension is not a source of official support. If something goes wrong
with your router, that is a matter for ASUS or the Asuswrt-Merlin community,
not for either of them to answer for this project.

---

## Compatibility

Read this section literally. The distinction between *verified on hardware*
and *derived from firmware source* is the whole point of it, and the extension
carries the same distinction per-page in its own Diagnostics view.

| Hardware | Generation | Status |
|---|---|---|
| **RT-BE92U** running Asuswrt-Merlin `3006.102.7_2` | Wi-Fi 7, ASUSWRT 5.0 (`3.0.0.6.102`) | **Live-verified.** The only router this extension has ever been run against. |
| **RT-AX88U** | Wi-Fi 6, ASUSWRT 4.0 (`3.0.0.4.388`) | **Structurally sourced, never live-tested.** Firmware source for this model was read and diffed; no RT-AX88U was ever contacted. |
| Other Wi-Fi 6 / 6E / 7 ASUS routers | — | **Untested.** See "graceful degradation" below. |
| **ROG / GT models** | — | **Out of scope. Not supported, and not intended to be.** |

### What "live-verified" covers

One physical router — the author's RT-BE92U — was probed read-only
([docs/LIVE_PROBE_RT-BE92U.md](docs/LIVE_PROBE_RT-BE92U.md)), and one narrow
human-supervised write session was run against it
([docs/WRITE_PATH_CHARACTERIZATION.md](docs/WRITE_PATH_CHARACTERIZATION.md)).
From the page catalog as it stands:

- **43 of 73 views** have a read path confirmed against that router.
- **30 of 73** are structurally sourced from firmware source analysis and have
  never had their read path exercised live.
- **1 view's** write path has been live-submitted and verified. **48** are
  implemented but have never been submitted to a live router at all.

A view being live-verified means it rendered correct data on *that one router,
on that one firmware build*. It is not a statement about any other unit.

### What "structurally sourced" covers

The RT-AX88U comparison in
[docs/CROSS_GENERATION_DIFF.md](docs/CROSS_GENERATION_DIFF.md) is a static
source diff against published GPL archives and the Asuswrt-Merlin git
repository. The report says so on its first page: no live router was contacted
at any point, and the author does not own an RT-AX88U. Nothing about
RT-AX88U support has been behaviourally tested, and it should be treated as an
informed guess, not a supported configuration.

### Graceful degradation is a design intent, not a test result

The extension does not assume features exist. Every view is gated on live
`*_support` flags read from the router's own `state.js` at runtime
(`src/lib/capabilities.ts`), with an `rc_support` fallback, so a router lacking
a feature should simply not show that view — this was observed working for one
flag (`nfsd_support = 0`) on the RT-BE92U.

That architecture is **designed** to degrade gracefully onto other Wi-Fi 6 /
6E / 7 hardware. It has not been **demonstrated** to. No second router of any
model has been tested. Treat any unit other than an RT-BE92U on ASUSWRT 5.0 as
unknown territory.

### ROG / GT models

ROG and GT models are explicitly out of scope, not merely untested. Those
models historically ship a distinct ROG-themed web UI gated behind
`RTCONFIG_ROG` and delivered as a separate firmware image, with different page
markup from the standard RT UI this extension is keyed to. The gap is recorded
in [docs/EXTERNAL_RESEARCH_RECONCILIATION.md](docs/EXTERNAL_RESEARCH_RECONCILIATION.md)
§1.6. No ROG hardware is available to the author, and no work has been done to
make the extension function there. Do not expect it to.

---

## Data handling

- **Everything stays on the router.** Every request the extension makes is a
  same-origin request to the router address you configured. There are no calls
  to any other host — no analytics, no telemetry, no crash reporting, no update
  check, no remote configuration.
- **Reads:** nvram values, status feeds, and log/diagnostic endpoints, using
  the browser's existing authenticated router session. The extension stores no
  router credentials and never sees your password.
- **Writes:** only what you explicitly apply, and only while the read-only
  interlock is off. Every constructed write — including ones blocked by the
  interlock — is recorded in the Diagnostics write inspector so you can see the
  exact request before and after.
- **Local storage:** extension settings only (router address, read-only
  interlock state). Nothing else is persisted.

---

## Installing

See [docs/GETTING_STARTED.md](docs/GETTING_STARTED.md) for install,
configuration, and first-run instructions written for end users.

## Development

```bash
npm install
```

```bash
npm run dev
```

```bash
npm run dev:firefox
```

## Building

```bash
npm run build
```

```bash
npm run build:firefox
```

## Documentation

End-user:

- [docs/GETTING_STARTED.md](docs/GETTING_STARTED.md) — install, configure, and
  what the extension does with your data.

Technical reports (written for a developer audience, not for end users):

- [docs/LIVE_PROBE_RT-BE92U.md](docs/LIVE_PROBE_RT-BE92U.md) — read-only live
  probe of the author's RT-BE92U.
- [docs/WRITE_PATH_CHARACTERIZATION.md](docs/WRITE_PATH_CHARACTERIZATION.md) —
  human-supervised live write session.
- [docs/STOCK_VS_MERLIN_DIFF.md](docs/STOCK_VS_MERLIN_DIFF.md) — stock vs
  Merlin source comparison, RT-BE92U.
- [docs/CROSS_GENERATION_DIFF.md](docs/CROSS_GENERATION_DIFF.md) — RT-AX88U vs
  RT-BE92U source comparison. Static only.
- [docs/EXTERNAL_RESEARCH_RECONCILIATION.md](docs/EXTERNAL_RESEARCH_RECONCILIATION.md)
  — external research passes reconciled against the empirical findings.
- [docs/NAV_TAXONOMY_PROPOSAL.md](docs/NAV_TAXONOMY_PROPOSAL.md) — the
  navigation reorganization.
- [docs/CURRENT_STATE_AUDIT.md](docs/CURRENT_STATE_AUDIT.md) — build and
  inventory audit.
- [docs/LICENSE_AUDIT.md](docs/LICENSE_AUDIT.md) — audit establishing that no
  GPL source was copied into this client.

## License

MIT — see [LICENSE](LICENSE). The reference firmware trees under `RAW/` are
ASUS and Asuswrt-Merlin GPL source, kept locally for analysis, and are not
covered by it.
