# Getting Started

This guide is for people who want to *use* Merlin's Cloak. The other files in
`docs/` are engineering reports written for a different audience — you don't
need any of them.

**Read this first:** this is pre-release software (`0.9.0-beta.1`). It has been
run against exactly one router. It ships with a read-only interlock switched on
so that it cannot change any router setting until you deliberately turn that
off. Please leave it on until you've had a look around.

---

## Contents

1. [Will it work with my router?](#1-will-it-work-with-my-router)
2. [Building the extension](#2-building-the-extension)
3. [Installing in Chrome](#3-installing-in-chrome)
4. [Installing in Firefox](#4-installing-in-firefox)
5. [First run](#5-first-run)
6. [Setting the router address](#6-setting-the-router-address)
7. [The read-only interlock](#7-the-read-only-interlock)
8. [What this extension reads, writes, and sends](#8-what-this-extension-reads-writes-and-sends)
9. [Uninstalling and going back](#9-uninstalling-and-going-back)
10. [Coverage by section](#10-coverage-by-section)

---

## 1. Will it work with my router?

| Your router | What to expect |
|---|---|
| **RT-BE92U** on Asuswrt-Merlin `3006.102.7_2` | This is the one router the extension has actually been tested against. |
| **RT-AX88U** | Support for it was worked out by reading the firmware source. No RT-AX88U has ever been tested. Treat it as an educated guess. |
| Another ASUS Wi-Fi 6 / 6E / 7 router on Merlin | Unknown. The extension checks which features your router reports before showing anything, so in principle it should hide what your router doesn't have — but no second router has ever been tried. |
| **ROG or GT model** | **Don't.** Those ship a different web UI that this extension is not built for, and no work has been done to support them. |
| Stock ASUSWRT (no Merlin) | Partly. Views marked Merlin-only are hidden automatically. The rest is untested on stock firmware. |

You also need Asuswrt-Merlin's web UI reachable over your LAN and to be logged
into it in the same browser — the extension rides your existing router login
and never asks for your password.

Section 10 has the per-section breakdown. The extension also shows you the same
information live, per page, under **Merlin's Cloak → Detection & Write Log →
Page confidence**.

---

## 2. Building the extension

There is no packaged download yet. You build it yourself. You need
[Node.js](https://nodejs.org/) — the version in `.nvmrc`, or newer.

From the project folder:

```bash
npm install
```

Then build for your browser:

```bash
npm run build
```

```bash
npm run build:firefox
```

This produces `.output/chrome-mv3/` and `.output/firefox-mv3/`. Those folders
are what you load in the next steps.

---

## 3. Installing in Chrome

1. Open `chrome://extensions` in the address bar.
2. Turn on **Developer mode** (top right).
3. Click **Load unpacked**.
4. Select the `.output/chrome-mv3` folder — the folder itself, not a file
   inside it.
5. "Merlin's Cloak v2" appears in the list. Pin it to the toolbar so you can
   reach its popup.

Chrome keeps unpacked extensions loaded across restarts. It will show a
"Disable developer mode extensions" warning each time you start the browser;
that is Chrome's standard notice for any unpacked extension, and dismissing it
does not remove this one.

To update after rebuilding, click the reload icon on the extension's card, then
reload the router page.

---

## 4. Installing in Firefox

> **Firefox installs do not survive a browser restart.** This is a Firefox
> limitation on temporary add-ons, not a bug in the extension. You will have to
> repeat these steps every time you start Firefox.
>
> **Firefox has also never been tested against a live router.** The build
> works; nobody has confirmed the extension behaves correctly in Firefox
> against real hardware.
>
> Between those two things, **Firefox is not yet suitable for non-technical
> users.** Use Chrome unless you are specifically helping to test Firefox.

1. Open `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on…**.
3. Select the **`manifest.json` file inside** `.output/firefox-mv3/` — Firefox
   wants the file here, not the folder.
4. "Merlin's Cloak v2" appears under Temporary Extensions.

Permanent installation requires a signed add-on, which this project does not
yet produce.

---

## 5. First run

1. Log into your router's web UI as you normally would.
2. Load any router page.

The extension replaces the page with its own interface. The sidebar lists
everything it can show; pick something read-only to start with — **Overview →
Router Status**, or **Live Status & Logs**.

A banner tells you read-only mode is on. That is correct and expected.

If nothing happens, check:

- You are on the router address the extension is configured for (section 6).
- You are actually logged into the router — the extension uses your existing
  session and cannot log in for you.
- In Chrome, that the extension is enabled on `chrome://extensions`.

---

## 6. Setting the router address

The extension activates automatically on `192.168.1.1`, `router.asus.com`, and
`www.asusrouter.com`. If your router is on a different address — `192.168.50.1`
is the other common ASUS default — tell the extension where it is:

1. Click the extension's toolbar icon to open its popup.
2. Type the address into **Router address**. Host or `host:port` only —
   `192.168.50.1`, or `192.168.50.1:8443`. No `http://`, no trailing path (the
   popup strips those if you include them anyway).
3. Click **Save**.
4. Your browser will ask you to grant the extension permission for that
   address. You have to accept: without it, the extension cannot run there.
5. Reload the router page.

This has to be done from the popup rather than from inside the extension's own
Settings view, because only the popup can ask your browser for that permission.
The Settings view shows the configured address read-only, and says so.

---

## 7. The read-only interlock

**Read-only mode is on by default, and stays on until you turn it off.**

While it is on, every Apply button still works — it builds the exact request it
would have sent, shows it to you, and then does not send it. Your router is not
contacted with anything that could change a setting. You can browse the whole
interface with no risk of altering your configuration.

You can see every one of these blocked requests under **Merlin's Cloak →
Detection & Write Log → Write inspector**, marked *dry-run*. That is the point
of the feature: read the request, decide whether it's what you meant, and only
then decide about turning the interlock off.

### Turning it off

Two places, same setting:

- The extension's toolbar popup — the **Read-only mode** checkbox.
- **Merlin's Cloak → Extension Settings → Write protection**.

The badge changes to *writes enabled*. Turn it back on the same way.

### Before you do

Please understand what is and isn't known here. Of the 49 views that can change
settings, **exactly one has ever had its changes submitted to a real router**
and confirmed to work — **Administration → System Settings → Advanced System
Tuning**, the page Merlin calls "Tweaks", in a human-supervised session. The
other 48 have write paths that are implemented, reviewed, and never once sent
to live hardware.

Some categories are flagged in the Detection & Write Log view as deliberately
excluded from that testing — wireless, WAN, DHCP, VPN, firewall, and anything
touching firmware, reboot, or reset. Those are the settings most likely to lock
you out of your own router if something goes wrong.

After any change the extension applies, it re-reads the value from the router to
confirm it actually took, because neither router endpoint's reply can be trusted
to mean anything. If it says *unconfirmed*, treat the change as not applied and
check the native UI.

Take a settings backup from the router's own UI before you turn the interlock
off, and know how to do a factory reset on your model.

---

## 8. What this extension reads, writes, and sends

**Nothing leaves your network. There is no telemetry of any kind.**

- **Every request goes to your configured router address and nowhere else.** No
  analytics, no crash reporting, no update check, no remote configuration, no
  third-party services. There is no server behind this extension, because there
  is no server at all.
- **What it reads:** router settings (nvram values), status feeds, and log and
  diagnostic endpoints — the same ones the router's own web pages read. It does
  this over your existing logged-in session.
- **Your password:** never seen, never stored, never asked for. The extension
  uses the session your browser already has.
- **What it writes:** only settings you explicitly apply, and only while the
  read-only interlock is off. Nothing is written in the background, on a timer,
  or at startup.
- **What it stores on your computer:** two things — the router address and
  whether read-only mode is on. That is the entire contents of its storage. No
  router data is cached or persisted.
- **What it shows you:** your own router's data, in your own browser. Your
  SSIDs, client MAC addresses, connection lists and VPN keys are visible in the
  interface because they are visible in the router's own UI. They stay there.

The Firefox build declares `data_collection_permissions: ['none']` in its
manifest, which is Mozilla's formal way of stating the same thing.

---

## 9. Uninstalling and going back

The extension replaces the router's pages only while it is installed and
enabled. Nothing is changed on the router itself.

- **Chrome:** remove it from `chrome://extensions`, or toggle it off.
- **Firefox:** remove it from `about:debugging`, or just restart Firefox.

Reload the router page and the native ASUS interface is back exactly as it was.
Any settings you applied while the interlock was off are real router settings
and stay applied — uninstalling does not revert them.

---

## 10. Coverage by section

Generated from the extension's own page catalog, which is the same data the
Detection & Write Log view displays.

Two things are tracked separately, and the difference matters:

- **Read: verified live** — this view was displayed against the author's
  RT-BE92U and showed correct data. On that one router, on that one firmware
  build.
- **Read: source-only** — this view was built by reading the firmware source.
  It has never been displayed against a real router. It may work perfectly. It
  has not been checked.

"Views that can change settings" counts views with a write path, and how many
of those have had a change confirmed on live hardware.

| Section | Views | Read: verified live | Read: source-only | Views that can change settings | Merlin-only |
|---|---:|---:|---:|---:|---:|
| Overview | 3 | 3 | 0 | — | 1 |
| Wireless | 7 | 2 | 5 | 7 (0 verified) | 1 |
| Local Network | 6 | 6 | 0 | 5 (0 verified) | — |
| Internet Connection | 4 | 1 | 3 | 4 (0 verified) | — |
| Security & Access Control | 12 | 2 | 10 | 12 (0 verified) | 1 |
| VPN | 9 | 6 | 3 | 8 (0 verified) | 4 |
| Traffic & Bandwidth | 9 | 8 | 1 | 4 (0 verified) | 3 |
| USB Storage & Sharing | 4 | 1 | 3 | 4 (0 verified) | 1 |
| Live Status & Logs | 7 | 3 | 4 | — | — |
| Network Diagnostics | 3 | 2 | 1 | 1 (0 verified) | — |
| Administration | 7 | 7 | 0 | 4 (1 verified) | 3 |
| Merlin's Cloak | 2 | 2 | 0 | — | — |
| **Total** | **73** | **43** | **30** | **49 (1 verified)** | **14** |

Notes:

- **Merlin-only** views are hidden automatically on stock ASUSWRT firmware.
- **USB Storage & Sharing** is hidden entirely if your router reports no USB
  support. Individual views are hidden the same way — NFS File Sharing
  disappears on routers without `nfsd_support`, for instance.
- 24 views can only read; they have no write path at all and cannot change
  anything even with the interlock off.
- The single verified write is **Administration → System Settings → Advanced
  System Tuning** (Merlin's "Tweaks" page).

For the per-page version of this table, open **Merlin's Cloak → Detection &
Write Log → Page confidence** in the extension. It reads from the same source
and reflects your router, not this document.

---

## Getting help

This is an independent project. It is **not affiliated with, endorsed by, or
sponsored by ASUSTeK Computer Inc. or the Asuswrt-Merlin project**, and neither
of them can help you with it. Equally, if your router misbehaves, that is a
question for ASUS or the Merlin community — please don't take a problem caused
by this extension to them without first removing it and checking the problem is
still there.
