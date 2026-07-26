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
- **Related loops:** none tracked (see `OPEN_LOOPS.md`).
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

### Operator review and push of local history

- **Set:** 2026-07-25
- **Goal:** Get operator sign-off to push the local-only commits to
  `origin/main`, which currently holds only the 7-commit scaffold-plus-
  research-docs base.
- **Why:** The full extension implementation exists only in local history;
  the public GitHub repo does not yet reflect the current state of the
  project.
- **Related loops:** none tracked.
- **Updates:** none yet.

---

## Achieved / Retired Goals

None yet.
