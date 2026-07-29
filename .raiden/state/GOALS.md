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
- **Updates:** none yet.

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

---

## Achieved / Retired Goals

### Operator review and push of local history — Achieved 2026-07-28

- **Set:** 2026-07-25.
- **Outcome:** All local history is on `origin/main`. Pushed across three
  operator-authorized pushes this session (`bac6965`, then `99b7a92` /
  `1c2705f` / `2d29065`); local `main` and `origin/main` are now identical.
  `origin/main` is no longer the 7-commit scaffold base described when this
  goal was set.
