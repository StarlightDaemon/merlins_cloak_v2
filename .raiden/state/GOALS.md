# Goals

## Active Goals

### Live-hardware verification of write paths

- **Set:** 2026-07-25
- **Goal:** Verify the 48 (of 49) implemented write paths that have never
  been submitted to a live router, under human-supervised sessions, starting
  with the already-contacted RT-BE92U and extending to RT-AX88U and other
  structural-only models.
- **Why:** Write correctness against real hardware is the primary blocker to
  moving past beta; read paths are already broadly exercised, but writes
  carry real router-configuration risk.
- **Related loops:** `OPEN_LOOPS.md` "Write-path correctness gaps" —
  source-research can narrow four specific open questions ahead of the live
  pass, but the live pass itself still needs the operator.
- **Updates:** 2026-07-31 — first live write test completed, operator-
  supervised: `wireless.ts`'s `wpsPage`, `wps_enable` field, both
  directions (1→0, 0→1), each independently confirmed by live nvram
  re-read; `wps_band_x` and every other wireless page remain untested and
  excluded. Full record: `docs/WRITE_PATH_CHARACTERIZATION.md` §4,
  `DECISIONS.md` D-022. Count: still 47 of 49 *pages* never submitted at
  all (Tweaks was the sole prior exception); WPS is now a second, partial
  exception. 2026-07-31 (later) — every solo-completable item in
  OPEN_LOOPS.md is now closed; a ready-to-run handoff for the next
  operator-present live session (ranked candidates: `wps_band_x`,
  WireGuard `wgs1_*`, the SDN SSID-semantics native-traffic observation)
  is at `.raiden/local/prompts/live-write-verification-handoff.md`.
  2026-07-31 (evening) — **that handoff was run to completion; all three
  ranked candidates closed** in one operator-present session, the first
  using full browser-automation tooling (which changed nothing about who
  submits a write: every write was the operator's own click or paste).
  1. `wps_band_x` both directions (D-029) → `wpsPage.confidence.write` is
     now `'live-verified'`, the first page beyond Tweaks with its full
     field set exercised live.
  2. WireGuard `wgs1_*` (D-030) → `writeExclusion: 'vpn'` lifted for the
     WireGuard Server page only; `wgs_addr`/`wgs_port` confirmed to land
     through the `wgs_unit` redirect and to clear back to empty —
     **closing the nvram-landing half of the CRITICAL D-008 finding
     live**. Still open by explicit operator choice: whether
     `restart_wgs` applies values to a *running* interface.
  3. SDN SSID key family (D-031) → resolved by observing native's own
     traffic with the extension disabled: native posts `apg{idx}_ssid`,
     never `wl{p}_ssid`. Two new SDN write-payload gaps filed.
  Count: 46 of 49 pages still never submitted at all; WPS is now fully
  verified, WireGuard Server partially (2 of 7 fields), Tweaks remains
  the original exception. Six UI/UX improvements also shipped from
  operator observations made during the same session.

### Firefox live verification

- **Set:** 2026-07-25
- **Goal:** Load the Firefox MV3 build against a live router and confirm
  parity with the Chrome-verified pass (nav taxonomy, read paths, console
  cleanliness).
- **Why:** The Firefox build passes structurally (tsc + eslint + build) but
  has never been loaded live; this is the other named reason `0.9.0-beta.1`
  is a beta rather than a release candidate.
- **Related loops:** none tracked.
- **Updates:** none yet.

### Chrome Web Store submission readiness

- **Set:** 2026-07-28
- **Goal:** Reach a submittable Chrome Web Store listing for
  `merlins-cloak-v2`.
- **Why:** The extension is functional and pushed, but a public store
  listing needs more than working code — hosted privacy policy, listing
  copy, permissions justification, a data-disclosure declaration, and real
  UI screenshots, plus the operator's own developer-account registration.
- **Related loops:** `OPEN_LOOPS.md` "Chrome Web Store readiness" (store
  listing screenshots — the one remaining solo-completable piece).
- **Updates:** 2026-07-28 — privacy policy drafted and live via GitHub
  Pages (`docs/privacy-policy.md`,
  https://starlightdaemon.github.io/merlins_cloak_v2/privacy-policy.html);
  store listing title/descriptions, permissions justification, and
  data-disclosure answers drafted (`docs/CHROME_STORE_LISTING.md`),
  permissions justification grounded in the actual runtime code (no
  permission trimmed further — the manifest's broad-looking
  `optional_host_permissions` is a Chrome match-pattern platform limit, not
  unminimized scope; see `App.tsx`'s `isPrivateRouterHost`). Operator
  mid-registration: non-trader, publisher name `StarlightDaemon`, contact
  email routed via a new `starlightdaemon.dev` Proton custom-domain address
  (handled in a separate session, not this repo). Screenshots remain open.
  2026-07-31 — screenshots captured and committed (`docs/store-assets/`,
  four 1280×800 PNGs from the fixture harness, fictional data only;
  `72983d9`, re-captured `34423f5`/`0df9636`); storage-permission
  justification updated for the new popup master switch's third stored
  value (`a553f5f`). The listing is now **asset-complete**; everything
  left is operator-only: optional promo tiles, the developer account, the
  dashboard submission itself, and a manual gh-pages sync of the updated
  privacy policy (see OPEN_LOOPS).

---

## Achieved / Retired Goals

### Operator review and push of local history — Achieved 2026-07-28

- **Set:** 2026-07-25.
- **Outcome:** All local history is on `origin/main`. Pushed across three
  operator-authorized pushes this session (`bac6965`, then `99b7a92` /
  `1c2705f` / `2d29065`); local `main` and `origin/main` are now identical.
  `origin/main` is no longer the 7-commit scaffold base described when this
  goal was set.
