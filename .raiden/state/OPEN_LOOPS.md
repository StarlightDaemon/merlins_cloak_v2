# Open Loops

Each entry below is written to be picked up standalone, by an agent session
with no memory of how it got here. Grouped by track; within a track, ordered
roughly by how self-contained the work is, not by priority.

## Chrome Web Store readiness

### Store listing screenshots
- **What:** Capture real screenshots of the extension UI for the Chrome Web
  Store listing. At least one (1280×800 or 640×400) is required;
  `docs/CHROME_STORE_LISTING.md` has the rest of the listing copy already
  drafted and notes this as the one missing asset.
- **Approach:** Build a small fixture-data harness (mock nvram/status
  values standing in for a real router) to render the popup and
  content-script UI standalone, then capture screenshots from that — not
  against a real router. Real router data should never appear in public
  screenshots regardless (it'd leak the operator's actual network
  configuration), so a mock harness is the correct approach, not a
  workaround forced by not having hardware access.
- **Blocked on:** nothing. Solo-completable.
- **Out of scope for this loop:** promotional tile images (optional, lower
  priority than the required screenshot); actual dashboard submission
  (operator-only — needs their Chrome Web Store account).

## Write-path correctness gaps (source-research-completable)

Four items STATUS.md flags as "confirm before trusting this write path."
Each is at least partially answerable by reading the Merlin firmware GPL
source already present in `RAW/` (httpd, rc, and related C sources) — no
live router required to make progress, though live testing is still the
final word. An agent with source access can close or substantially narrow
each of these without operator involvement.

### Wireless band-token field naming
- **Question:** `Advanced_Wireless_Content.asp`'s own JS posts band-role-
  token field names (`2g1_*`) via `httpApi.nvramSet`; this project's defs
  post canonical `wl{N}_*` keys instead. Does `validate_instance` in the
  firmware's httpd source actually treat these as equivalent for every
  write this UI performs, or only for some?
- **Where:** `src/pages/defs/wireless.ts`; firmware source in `RAW/` (grep
  `validate_instance`, `2g1_`, `wl0_` in the httpd tree).
- **Why it matters:** if they're not equivalent, some wireless writes could
  silently no-op or write the wrong nvram key.

### WireGuard server (`wgs1_*`) direct-prefixed writes
- **Question:** `vpn-server.ts` flags these as a "leap of faith" — no
  confirmed `validate_instance` branch was found for `wgs1_*`-prefixed keys
  during the original implementation pass. Does one exist?
- **Where:** `src/pages/defs/vpn-server.ts`; firmware source in `RAW/`.

### `ipsec_profile_2` regeneration
- **Question:** Native firmware regenerates `ipsec_profile_2` on every
  IPSec save; this UI doesn't reproduce that. What exactly triggers the
  regeneration natively (which script/binary, on what event), and does the
  UI need to trigger it too, or is it safe to enable IPSec without it?
- **Where:** IPSec fields in `src/pages/defs/vpn-server.ts`; firmware
  source in `RAW/`.

### `rcService` restart vs. stop branching
- **Question:** The UI can't currently branch enable→restart vs.
  disable→stop for VPN servers/IPSec; it always issues a static restart.
  What does the native firmware actually call for each transition, and is
  the static-restart simplification harmless for nvram-only state, or does
  it leave a service running/stopped incorrectly?
- **Where:** rcService call sites in `src/lib/router-io.ts`; firmware
  source in `RAW/` (`rc` tree, service start/stop/restart dispatch).

## Missing features (deferred scope)

Each of these is a genuinely new feature — nothing currently reads or
writes for them, this isn't a bug fix. Pure implementation work; no live
router needed until final verification. Listed roughly in the order
STATUS.md originally deferred them, not a priority ranking — an agent
picking this up should feel free to resequence.

1. **SDN profile creation/editing** — currently read-only overview only
   (`src/pages/defs/sdn.tsx`); profile CRUD deferred.
2. **Per-user Samba/FTP permissions** — the USB sharing views
   (`src/pages/defs/usb.ts`) cover shares but not per-user permission
   grants.
3. **OpenVPN server client list** (`vpn_serverx_clientlist` — username/
   password client management).
4. **WireGuard server peers** — peer add/edit/remove for the WireGuard
   server role (distinct from the `wgs1_*` write-correctness question
   above, which is about the server's own config, not peer management).
5. **Certificate/key BLOB handling** — upload/view/replace for TLS certs
   and keys across VPN and admin contexts.
6. **Operation Mode switching** (router/AP/repeater/media bridge modes).
7. **Time Machine** (USB-attached Time Machine backup target config).
8. **Download Master** (USB download-station app).
9. **AiMesh node management**.
10. **Notification center**.
11. **`Advanced_QOSUserPrio`** — per-priority percentage allocation,
    distinct from the QoS rules/limiter/classification views already
    implemented.
12. **Dashboard WAN card dual-WAN aggregation** — currently shows `wan0`
    only; no aggregated view when dual-WAN is active.

## Cross-reference: pre-existing, operator-gated loops

Tracked in full in `GOALS.md`, not duplicated here — both require the
operator's live router and/or browser, not solo-agent-completable:

- Live-hardware verification of write paths (48 of 49 never live-submitted).
- Firefox live verification (never run against live hardware at all).
