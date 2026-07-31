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
| `/content.html#/dashboard` | Dashboard / Network Map replacement | WAN status, LAN IP, wireless radios |
| `/content.html#/clients` | Connected Devices | DHCP leases merged with live wireless-station presence |
| `/content.html#/dhcp` | Address Assignment (DHCP) settings page | A representative declarative `SettingsPageDef` page, incl. the static-lease rule-list editor |

`content.html` is a single hash-routed entry point — it mounts the *whole*
app shell (nav, header, capability chips), exactly like the real content
script does on a router page. Any page id from `src/pages/registry.ts` can
be loaded the same way (`content.html#/<page-id>`), but only dashboard,
clients and dhcp have fixture data modeled for them; other pages will render
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
   (`/appGet.cgi`, `/ajax_sysinfo.asp`, `/applyapp.cgi`, `/start_apply.htm`)
   and answers them from `mocks/fixtures.ts`. Any other request (vite's own
   dev-server/HMR traffic, module fetches, etc.) is passed straight through
   to the real `fetch`.

Capability detection (`src/lib/capabilities.ts`) ends up on its rc_support
fallback path in this harness (no real "MAIN world" `*_support` globals
exist on a plain page, and the background-collector message always
rejects), so the fixture's `rc_support` nvram value
(`mocks/fixtures.ts` → `FIXTURE_NVRAM.rc_support`) is what actually turns
features like the 6 GHz radio row on/off. `ajax_sysinfo.asp` is also the
Merlin-vs-stock branch probe; the fixture answers it, so the header shows
"Asuswrt-Merlin".

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
- SSIDs `MerlinNet-Demo` / `-5G` / `-6G`.
- Six fictional client devices (`study-laptop`, `living-room-tv`,
  `kitchen-tablet`, `guest-phone`, `nas-server`, `garage-cam`) with
  `02:1A:2B:00:10:0x` MAC addresses (the `02:` prefix is the
  locally-administered range — never a real vendor OUI), mixed across
  wired/2.4/5/6 GHz to exercise the Clients page's band badges.
- Two of those clients also appear as DHCP static-lease reservations for the
  DHCP settings page.

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

## Known limitations

- Only dashboard, clients and dhcp have tailored fixture data. Other nav
  pages render (layout/nav/empty states work) but with blank field values —
  extend `mocks/fixtures.ts` / `mocks/router-fetch.ts`'s `RAW_HOOK_PAYLOADS`
  map if more views are needed for a future screenshot round.
- The popup's "Open router UI" button and any settings-page "Apply" click
  are no-ops/mocked acks in this harness (there is no real router to send
  to) — fine for static screenshots, not meant for interaction testing.
- Not yet visually verified in a browser (out of scope this round); the
  next pass should load each URL above, confirm layout at 1280×800, and
  capture the screenshots.

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
