# Screenshot harness

Renders Merlin's Cloak's real UI components in a plain browser tab, fed by
FICTIONAL router data, so Chrome Web Store screenshots can be captured
without a real router. This directory is **not** part of the shipped
extension: `wxt build`/`wxt zip` only ever scan `srcDir: 'src'` (see
`wxt.config.ts`), so nothing here reaches `.output/` or a store package.

## Launch

From the repo root (uses the repo's already-installed vite — no extra
install needed):

```sh
npx vite tools/screenshot-harness
```

This starts a dev server (default `http://localhost:5173`) and prints the
URL. Open it, or jump directly to one of the views below. Set the browser
window/viewport to **1280×800** before capturing — that's the Chrome Web
Store screenshot size.

To confirm the harness still compiles without starting a server:

```sh
node_modules/.bin/vite build tools/screenshot-harness
```

This bundles it into `tools/screenshot-harness/dist/` (its own output
directory — never the repo's `.output/`). Delete `dist/` freely; it's a
disposable build artifact, not something to ship or commit.

## Views / routes

| URL | Renders | Notes |
| --- | --- | --- |
| `/index.html` | Landing page with links to everything below | |
| `/popup.html` | The real toolbar popup (`src/entrypoints/popup`) | Router address + read-only toggle, pre-seeded to the fixture address |
| `/content.html#/dashboard` | Dashboard / Network Map replacement | WAN status, LAN IP, wireless — SDN fixture by default (network-centric "Wireless networks" table + per-band radio-state strip) |
| `/content.html?classic=1#/dashboard` | Dashboard, classic (non-SDN) fallback | Same page with the `mtlancfg_support` capability flag off — the original plain per-band wl0/1/2_ssid "Wireless radios" table |
| `/content.html?dualwan=1#/dashboard` | Dashboard, dual-WAN | Adds the `dualwan` capability flag + a populated `wan1_*`/`wans_dualwan`/`wans_mode` (Failover) set — Primary/Standby WAN cards instead of the single "Internet" card. The default (no `?dualwan=1`) route is untouched — byte-identical to before this variant existed. |
| `/content.html#/clients` | Connected Devices | DHCP leases merged with live wireless-station presence |
| `/content.html#/dhcp` | Address Assignment (DHCP) settings page | A representative declarative `SettingsPageDef` page, incl. the static-lease rule-list editor |
| `/content.html#/sdn` | Separate Networks & Guest Wi-Fi | 5 SDN profiles (MAINFH/MAINBH view-only, 3 guest-class Edit/Delete) — pre-existing fixture, its editing affordances (create/edit/delete modal) render against it unmodified |
| `/content.html#/qos-userprio` | QoS — Priority Bandwidth Allocation | `qos_orates`/`qos_irates` decomposed per-priority-band upload/download %, plus the ACK/SYN/FIN/RST/ICMP boost radios |
| `/content.html#/notification-center` | Notification Center | `get_nt_db()` event list (3 fictional events: one read, one unread with a template, one unread with NO template entry AND no `eName` to exercise the raw-hex "Event 0x…" title + body fallback) + `/nt_content.json` |
| `/content.html#/aimesh` | AiMesh Node Management | CAP/master + 2 RE nodes (one offline, `02:`-prefix MACs) via `get_cfg_clientlist()`, plus one read-only onboarding candidate via `get_onboardinglist()`/`get_onboardingstatus()` |
| `/content.html#/timemachine` | Time Machine | `timemachine_enable`/`tm_device_name`/`tm_vol_size`/`tm_ui_setting` |
| `/content.html#/download-master` | Download Master / USB Apps (status) | Read-only `apps_*` status fields |
| `/content.html#/wireguard-server` | WireGuard Server | Server unit 1 populated (`wgs1_*`); Server 2 selectable but intentionally blank, matching native's own unreachability of that unit |
| `/content.html#/wireguard-server-peers` | WireGuard Server Peers | 3 fictional peers on server unit 1 (`wgs1_c1..c3_*`, two enabled + one disabled), 10-slot peer selector |
| `/content.html#/opmode` | Operation Mode | Read-only; `sw_mode`/`wlc_*` fixture values derive as plain "Router" (token `rt`) |
| `/content.html#/router-cert` | Router HTTPS Certificate | `httpd_cert_info()` metadata (Let's Encrypt mode, `le_enable=1`) |
| `/content.html#/vpn-certs` | VPN Certificates & Keys | OpenVPN cert/key presence via the `/ajax_openvpn_server.asp` side-channel (Server 1 + Client 1 populated, all else absent) and WireGuard private-key presence (`wgs_priv`/`wgc1_priv` present, `wgc2..5_priv` absent) |

`content.html` is a single hash-routed entry point — it mounts the *whole*
app shell (nav, header, capability chips), exactly like the real content
script does on a router page. Any page id from `src/pages/registry.ts` can
be loaded the same way (`content.html#/<page-id>`), but only the routes
listed above have fixture data modeled for them; other pages will render
structurally correctly (nav, layout, empty states) with blank field values
rather than fixture content, since the fetch mock (see below) always answers
something instead of erroring.

## How the mocks work

Nothing under `src/` was modified. Two seams already exist in the real code
and this harness plugs into them from the outside:

1. **`browser` (WebExtension APIs)** — `src/lib/settings.ts`,
   `src/lib/capabilities.ts` and the popup import `browser` from
   `wxt/browser`. `vite.config.ts` aliases that specifier, for this harness
   root only, to `mocks/browser.ts`: an in-memory `storage.local` +
   `storage.onChanged` implementation (pre-seeded with a fixture router
   address), a `runtime.sendMessage` that always rejects (so capability
   collection falls through to the rc_support-derived flag path — see
   below), and no-op `tabs.create` / always-granted `permissions.request`.

2. **Router I/O (`fetch`)** — `src/lib/router-io.ts` talks to the router
   exclusively through the global `fetch` (same-origin XHR, per its own
   header comment) — no `browser.*` call is involved. `content-entry.tsx`
   imports `mocks/router-fetch.ts` first for its side effect: it replaces
   `window.fetch` with a shim that recognizes the router's actual endpoints
   (`/appGet.cgi`, `/ajax_sysinfo.asp`, `/applyapp.cgi`, `/start_apply.htm`,
   plus two plain same-origin GET files the Notification Center and VPN
   Certificates pages fetch directly — `/nt_content.json` and
   `/ajax_openvpn_server.asp`) and answers them from `mocks/fixtures.ts`.
   Any other request (vite's own dev-server/HMR traffic, module fetches,
   etc.) is passed straight through to the real `fetch`.

Capability detection (`src/lib/capabilities.ts`) ends up on its rc_support
fallback path in this harness (no real "MAIN world" `*_support` globals
exist on a plain page, and the background-collector message always
rejects), so the fixture's `rc_support` nvram value
(`mocks/fixtures.ts` → `FIXTURE_NVRAM.rc_support`) is what actually turns
features like the 6 GHz radio row and the SDN (`mtlancfg_support`) path
on/off. `ajax_sysinfo.asp` is also the Merlin-vs-stock branch probe; the
fixture answers it, so the header shows "Asuswrt-Merlin".

`rc_support` defaults to `FIXTURE_RC_SUPPORT_SDN` — `mtlancfg` (SDN) plus
every other gating token this round's pages need: `nt_center`/
`nt_center_ui` (Notification Center), `amas` (AiMesh), `timemachine`,
`wireguard`, `openvpnd` (WireGuard/OpenVPN server + cert pages), and `usb`
(the USB Storage & Sharing nav group itself) — so
`content.html#/dashboard` renders the SDN-managed path, and all of these
pages' nav entries/gates are satisfied, by default. Appending `?classic=1`
to the URL *before* the `#` (hash-fragment content is never part of
`location.search`, so it must go there, not after the route) — e.g.
`content.html?classic=1#/dashboard` — makes `mocks/router-fetch.ts` answer
`rc_support` with `FIXTURE_RC_SUPPORT_CLASSIC` instead (drops every token
above, not just `mtlancfg`), switching the Dashboard to its classic
non-SDN fallback rendering. Appending `?dualwan=1` instead answers
`rc_support` with `FIXTURE_RC_SUPPORT_DUALWAN` (`FIXTURE_RC_SUPPORT_SDN`
plus `dualwan`) and swaps in `FIXTURE_DUALWAN_NVRAM`'s populated
`wan1_*`/`wans_dualwan`/`wans_mode`/`wans_lb_ratio`/`wan{0,1}_primary`
values, switching the Dashboard to its dual-WAN Primary/Standby rendering.
`?classic=1` and `?dualwan=1` are mutually exclusive fixture-variant
switches (both key off `nvramValue()`'s handling of the `rc_support` read,
checked in that order); extend the same pattern in `router-fetch.ts` if a
future page needs another URL-switchable variant.

`content-entry.tsx` reproduces only the *mounting* half of
`src/entrypoints/content.tsx` (shadow root, `buildThemeCss()` injection,
`registerAllPages()`, `<App/>`) — the rest of that file is router-page
detection/exclusion logic and the `defineContentScript` WXT build macro,
neither of which has any meaning outside an actual router page / the WXT
compiler pipeline.

## Fixture data summary

See `mocks/fixtures.ts` for the full table. Everything is invented:

- Product id `RT-DEMO88U`, firmware `3.0.0.6.9999.fixture_demo` — stamped
  "DEMO"/"fixture" so it can't be mistaken for a real device.
- LAN `192.168.50.0/24` (RFC1918); WAN address `203.0.113.42`
  (RFC 5737 TEST-NET-3 — never a real routable address).
- SSIDs `MerlinNet-Demo` / `-5G` / `-6G` (classic per-band fallback path).
- SDN path (default): four fictional `sdn_rl` networks — `MerlinNet-Demo`
  (Main, all 3 bands), `MerlinNet-Guest` (2.4+5 GHz), `MerlinNet-IoT`
  (2.4 GHz only), plus a `MAINBH` backhaul record and a disabled `Kids`
  network to exercise the Dashboard's backhaul-skip and enabled-only
  filters. See `mocks/fixtures.ts` FIXTURE_NVRAM's `sdn_rl`/`subnet_rl`/
  `apg{idx}_*` block.
- Six fictional client devices (`study-laptop`, `living-room-tv`,
  `kitchen-tablet`, `guest-phone`, `nas-server`, `garage-cam`) with
  `02:1A:2B:00:10:0x` MAC addresses (the `02:` prefix is the
  locally-administered range — never a real vendor OUI), mixed across
  wired/2.4/5/6 GHz to exercise the Clients page's band badges.
- Two of those clients also appear as DHCP static-lease reservations for the
  DHCP settings page.
- Dual-WAN (`?dualwan=1` only): a second WAN unit on TEST-NET-2
  (`198.51.100.0/24`, RFC 5737), Failover mode with unit 0 as primary. See
  `FIXTURE_DUALWAN_NVRAM`.
- QoS Priority Bandwidth Allocation: `qos_orates`/`qos_irates` joined-string
  fixtures plus the ACK/SYN/FIN/RST/ICMP boost flags (`on`/`off` scalars, not
  `1`/`0`). See `FIXTURE_NVRAM.qos_orates` etc.
- Notification Center: three fictional `get_nt_db()` events
  (`FIXTURE_NT_EVENTS`) — one read, one unread with a matching
  `/nt_content.json` template entry, and one unread event whose id has
  neither a template entry nor an `eName`, deliberately exercising the raw-
  hex `"Event 0x…"` title fallback and its matching "raw event id … status
  flags …" body fallback.
- AiMesh: three fictional nodes (`FIXTURE_AIMESH_NODES`) — the CAP/master,
  an online RE node with a 2.4 GHz backhaul, and an offline RE node — plus
  one onboarding candidate, all `02:1A:2B:00:30:0x`-range MACs.
- WireGuard Server + Peers: server unit 1 (`wgs1_*`) and three fictional
  peers on it (`wgs1_c1..c3_*`, two enabled, one disabled). All key/PSK
  material is an obviously-fake placeholder string
  (`FAKE-DEMO-...-NOT-REAL`), never real key bytes.
- Router HTTPS Certificate + VPN Certificates & Keys: `httpd_cert_info()`
  fixture metadata (`FIXTURE_HTTPD_CERT_INFO`, Let's Encrypt mode) and an
  `/ajax_openvpn_server.asp` presence side-channel
  (`buildAjaxOpenvpnServerText()`) with a few populated OpenVPN slots —
  every PEM-shaped value is an obviously-fake placeholder
  (`-----BEGIN FAKE DEMO CERTIFICATE-----` etc.), never real PEM.
- Operation Mode: `sw_mode`/`wlc_*` set so `deriveOpMode()` reads as plain
  Router (token `rt`).
- Time Machine / Download Master: `tm_device_name` `sda1`, a fictional
  `/tmp/mnt/DEMO_USB` mount path, and a handful of plausible `apps_state_*`
  status codes.

## Verification performed

- `node_modules/.bin/vite build tools/screenshot-harness` completes clean
  (3 HTML entries, ~75 modules transformed) into
  `tools/screenshot-harness/dist/`.
- Confirmed the built bundles contain no unresolved `wxt/browser` import
  specifier (the alias resolved).
- Confirmed `wxt.config.ts` only ever scans `srcDir: 'src'`, so this
  directory is invisible to `wxt build`/`wxt zip` and the pre-existing
  `.output/` folder is untouched by the harness build.
- No devDependency was installed: `@vitejs/plugin-react` and `vite` itself
  were already present in `node_modules` (transitive deps of
  `@wxt-dev/module-react` / `wxt`).
- Did **not** launch a browser or capture screenshots this round — build
  and static verification only, per the task's scope for this pass.

**Later round** (dual-WAN dashboard, `qos-userprio`, `notification-center`,
`aimesh`, `timemachine`/`download-master`, `wireguard-server`/
`wireguard-server-peers`, `opmode`, `router-cert`/`vpn-certs`, plus
re-verifying `sdn`'s new editing affordances): actually launched
`npx vite tools/screenshot-harness` and captured headless-Chrome
1280×800 screenshots for all twelve routes above (the eleven new ones plus
`sdn`), then read every PNG back to confirm it actually rendered fixture
data — not a blank page or an error banner — before treating any of them as
verified. Two defects were found and fixed in the fixture data itself, not
in `src/`, during this pass:
- A `*/` sequence inside two doc comments (`wan1_*/wans_dualwan/...`) closed
  the block comment early and broke the build — reworded, not just deleted.
- The Notification Center's raw-hex-fallback event initially had `msg: ''`,
  which is a valid string and short-circuited `eventBody()`'s further
  fallback chain before it reached the "raw event id … status flags …"
  line — fixed by omitting `msg` entirely (undefined, not empty) for that
  one fixture row.
Also confirmed the single-WAN Dashboard default (no `?dualwan=1`) still
renders byte-identical to before the dual-WAN variant existed.

## Known limitations

- Only the routes listed in the table above have tailored fixture data.
  Other nav pages render (layout/nav/empty states work) but with blank
  field values — extend `mocks/fixtures.ts` / `mocks/router-fetch.ts`'s
  `RAW_HOOK_PAYLOADS` map (or its `buildJsonEnvelope` per-hook special
  cases) if more views are needed for a future screenshot round.
- The popup's "Open router UI" button and any settings-page "Apply" click
  are no-ops/mocked acks in this harness (there is no real router to send
  to) — fine for static screenshots, not meant for interaction testing.
- WireGuard Server's instance selector only has fixture data for unit 1
  (matching native's own unreachability of unit 2 — see the page's own
  header comment); WireGuard Server Peers only has fixture data for peers
  1-3 of the 10 selectable slots.
- A block comment containing a literal `*/` (even split across words, e.g.
  `wan1_*` immediately followed by `/wans_dualwan`) will silently truncate
  and break the build with a confusing downstream syntax error pointing at
  unrelated text further down the comment — watch for this when writing
  nvram-key-list prose in comments here.

## Capturing store screenshots

The in-app Browser pane's screenshot tool can't persist PNGs to disk, and a
canvas-rasterization workaround was rejected by Chrome (tainted-canvas
export). The working method is headless Chrome (or Edge, same engine) via
the CLI, against a running instance of this harness (`npx vite
tools/screenshot-harness`, default `http://localhost:5173`):

```sh
"C:\Program Files\Google\Chrome\Application\chrome.exe" \
  --headless=new --disable-gpu --hide-scrollbars \
  --window-size=1280,800 --virtual-time-budget=15000 \
  --screenshot="<abs-output-path>.png" \
  "http://localhost:5173/<route>"
```

One invocation per route (`popup.html`, `content.html#/dashboard`,
`content.html#/clients`, `content.html#/dhcp`). `--virtual-time-budget`
gives the SPA time to mount and the fixture fetches time to resolve before
the screenshot is taken; raise it if a capture comes back blank.
`msedge.exe` at the same path pattern under `Microsoft\Edge\Application`
works as a drop-in fallback if Chrome isn't installed. Verify each output
is exactly 1280×800 by reading the PNG IHDR width/height (bytes 16 and 20,
big-endian) rather than trusting the file to "look right".
