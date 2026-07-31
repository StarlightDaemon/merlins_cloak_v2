# Solo-Completable Remainder — Handoff Prompt

## Prompt ID

`merlins_cloak_v2.handoff.solo-remainder.2026-07-31.v1`

## Purpose

Everything a solo agent (or small agent group) can close without the
operator physically present has been closed as of 2026-07-31 — see
`STATUS.md`, `CHANGELOG.md` `[Unreleased]`, and `.raiden/state/DECISIONS.md`
D-001 through D-024. What's left toward 1.0 is almost entirely "sit at the
router with a browser open," which no agent can do. This prompt hands off
the small residue that genuinely is still agent-completable: two lingering
source-research questions, one mechanical cross-branch sync, and one
research deliverable (not code) that shortens every future live-testing
session. It is deliberately narrow — do not expand scope beyond §5 without
the operator's say-so (see "Explicitly not in scope" below).

## Target Agent

Fable-tier orchestrator (or equivalent) coordinating 2–3 subagents. This is
a much smaller pass than the 2026-07-31 1.0-readiness pass it follows — do
not over-provision. One research agent, one small execution agent, and the
orchestrator's own closing verification pass is enough.

## Template

```text
You are picking up Merlin's Cloak v2 (E:\Citadel\merlins_cloak_v2) after a
1.0-readiness pass and an interactive continuation, both completed
2026-07-31. You have no memory of either. Everything you need is in the
repo's own state files — read them before planning anything.

## 1. Read first, in this order

- STATUS.md, CHANGELOG.md (`[Unreleased]` section specifically)
- .raiden/state/{CURRENT_STATE,OPEN_LOOPS,DECISIONS,GOALS}.md — DECISIONS.md
  D-001 through D-024 is the full reasoning trail; OPEN_LOOPS.md is the
  authoritative list of what remains, grouped by track
- docs/WRITE_PATH_CHARACTERIZATION.md — two live-write sessions are
  recorded here (§1-3: Tweaks page, four fields; §4: WPS wps_enable,
  bidirectional). This is the reference example of what a properly
  evidenced write-path characterization looks like — match its rigor if
  your work touches this file.
- tools/screenshot-harness/README.md — the fixture-data harness. Any UI
  change gets verified here, never against a real router.

Treat all of it as a starting hypothesis, not ground truth — re-derive
from actual source/code where it matters, the same discipline the prior
passes used.

## 2. Hard boundaries — unchanged from every prior pass, still absolute

1. No write of any kind may ever be submitted to a live router, by you or
   any subagent, for any reason.
2. No live browser/router session access — no cookies, no authenticated
   session, no navigating to the actual router admin UI. RAW/ (vendored
   GPL firmware source) is read-only reference; never modify it.
3. Do NOT lift, modify, or propose lifting any `writeExclusion` tag on
   any page def. That decision is reserved for a moment where the
   operator is actually present and choosing, the way D-022's WPS test
   was — a conversation, not a autonomous default. Your job on write-path
   items is to produce a well-evidenced CANDIDATE LIST for that future
   conversation, not to arm anything.
4. Do not attempt Firefox live verification, live-hardware verification
   of any kind, or Chrome Web Store submission — all operator-only.
5. Do not push to `origin`. Commit locally; pushing is a separate,
   explicitly operator-authorized step.
6. Do not touch the `gh-pages` branch's `index.html` or `style.css` —
   only `privacy-policy.html`, and only the specific sync described in
   §5.2 below.

If you find a piece of work in §5 actually depends on one of these, don't
force it — reclassify it, log why, move on.

## 3. Definition of Done for this pass

- Every item in §5 is either closed (with evidence) or explicitly
  reclassified as blocked, with the OPEN_LOOPS.md entry updated either
  way — no silent drops.
- `npx tsc --noEmit` clean, `npm run lint` clean (prefer this over bare
  `npx eslint .` — the latter has intermittently hit an unrelated
  environment/permission issue in past sessions; `npm run lint` is the
  reliable command).
- `npm audit` still 0 vulnerabilities.
- `npm run build` and `npm run build:firefox` both succeed, current
  output in `.output/`.
- STATUS.md, CHANGELOG.md, and .raiden/state/{OPEN_LOOPS,DECISIONS,
  CURRENT_STATE}.md all reflect what closed — follow the existing entries'
  own style (dated, specific, cite commit hashes) rather than inventing a
  new format.
- A final report per §8.

## 4. Explicitly not in scope for this pass

- The 13 deferred features listed in OPEN_LOOPS.md's "Missing features"
  section (SDN profile CRUD, WireGuard peers, cert/key BLOBs, Operation
  Mode switching, and the rest). These are deliberately out of scope for
  1.0 — do not start any of them. If the operator wants a separate pass
  for post-1.0 feature work, that's a different handoff.
- Anything requiring the operator's own router, browser session, GitHub
  push, or Chrome Web Store account (see hard boundaries above and
  OPEN_LOOPS.md's "Cross-reference: pre-existing, operator-gated loops").

## 5. The work itself

### 5.1 Close (or further narrow) two open source-research questions

Under OPEN_LOOPS.md's "Wireless band-token field naming" entry (marked
closed for the key-FORMAT question, D-006), two sub-notes were left
genuinely unresolved:

  a. **Client-side band-token translation** — whether
     `Advanced_Wireless_Content.asp`'s own JS (cited: `asus.js` around
     line 321-374, `RAW/merlin/release/src/router/www/js/asus.js`)
     translates band-role-token keys (`2g1_`, `5g1_`, `6g1_`) to
     `wl`-prefixed keys client-side before POSTing, or posts band-tokens
     as-is (in which case the D-006 finding that the server only accepts
     `wl`-prefixed keys would mean the NATIVE page's own writes rely on
     this client-side translation — worth confirming either way, since it
     bears on whether this project's own `wl{p}_*`-posting approach in
     `wireless.ts` is provably equivalent to native, not just "the only
     format the server accepts").
  b. **Physical radio band index mapping** — confirm from source (not
     from the prior session's brief, which asserted it without a source
     citation) that `wl0`=2.4GHz, `wl1`=5GHz, `wl2`=6GHz on this
     firmware generation. Look for `wl_ifnames` population order,
     `get_wl_nband_list()` (noted in `wireless.ts`'s own header comment
     as closed-Broadcom-SDK, likely unavailable — confirm that's still
     true before giving up), or any other source that assigns unit
     index to physical band.

Both were already attempted once — read the existing research trail in
`wireless.ts`'s file header comment and D-006 before re-treading the same
ground. If genuinely nothing new is findable from `RAW/`, say so
explicitly and close the note as "attempted again, still unconfirmable
from available source" rather than leaving it ambiguous. Do not attempt
external web research for this — D-012 already found that unproductive
for exactly this class of question (missing source files) and it
introduced a fabrication risk; if you want to try a materially different
method, flag it to the operator first rather than silently reusing the
already-discredited approach.

### 5.2 gh-pages privacy policy sync

`docs/privacy-policy.md` on `main` was updated 2026-07-31 (`a553f5f`) to
list three stored values instead of two (the popup master enable/disable
switch added a third `chrome.storage` key). The manually-maintained
duplicate `privacy-policy.html` on the `gh-pages` branch was not synced.

- Work in an isolated worktree (`git worktree add`) checked out to
  `gh-pages` — never touch `main`'s working tree for this.
- Diff `docs/privacy-policy.md` (main) against `privacy-policy.html`
  (gh-pages) to find exactly what changed — the stored-values list is
  the known delta; check for any other drift while you're there, since
  no automated sync exists and this may not be the first time they've
  diverged.
- Mirror the content faithfully — same substance, gh-pages' own HTML
  structure/styling (it's Fujin-themed per prior session notes; match
  its existing conventions, don't restyle).
- Do NOT touch `index.html` or `style.css` on that branch.
- Commit locally on `gh-pages` in that worktree. Do NOT push, on either
  branch.
- Remove the worktree when done (`git worktree remove`).

### 5.3 Next Live Write-Path Test Candidates — a report, not code

The single most useful deliverable this pass can produce: a prioritized,
evidence-backed list of candidate fields/pages for the operator's NEXT
supervised live-write session, in the same rigor as
`docs/WRITE_PATH_CHARACTERIZATION.md` §4's WPS writeup — but produced
BEFORE any test happens, not after, so the operator can pick a target in
five minutes instead of an hour of research each time.

For each candidate (survey across ALL categories, not just wireless —
WAN, DHCP, Administration, USB, everywhere a page is currently
`unverified-write`), produce:

- The exact field(s) and page.
- What native firmware source says the write does (endpoint, exact
  payload shape, `action_script`/`rc_service`, any client-side
  validation) — cite file:line in `RAW/`.
- A concrete risk assessment: what's the worst case if the write is
  wrong? (WPS's `wps_enable` was chosen specifically because a wrong
  value can't take down the operator's own network connection — look
  for the same property. Prefer fields where a bad write is
  self-evidently and immediately reversible.)
- Whether this project's current implementation already matches native's
  request shape exactly (i.e., is this a "just needs a live click to
  confirm" candidate, or does something need fixing first).

Rank the list low-risk-first. Save as a new file,
`docs/WRITE_PATH_TEST_CANDIDATES.md`, and add one line to
`.raiden/state/OPEN_LOOPS.md` pointing to it so a future session finds it
without re-deriving the list. This does NOT touch any `writeExclusion`
tag or page def — it is pure documentation, reserving the actual
decision for the operator.

## 6. How to operate

- Batch 5.1 and 5.2 in parallel (independent files, no shared state) —
  one research agent for 5.1, one execution agent (worktree-isolated,
  since it's on a different branch) for 5.2.
- 5.3 can run concurrently too, but it reads across the WHOLE page-def
  tree — if it and 5.1 would both be reading/citing the same wireless.ts
  file, that's fine (both read-only), just don't have either agent EDIT
  wireless.ts while the other is mid-research.
- Model tier: Sonnet for all three — this is source research and
  documentation, not mechanical execution, and not deep architectural
  judgment either.
- You (the orchestrator) do the closing verification pass yourself:
  re-run the Definition-of-Done suite against the merged result, don't
  trust any subagent's self-reported "tsc passed."

## 7. Git and commit discipline

- Commit each closed item separately, in this repo's existing commit
  style (small, atomic, specific — `git log` shows the pattern).
- This repo's commit-msg hook rejects `Co-Authored-By` trailers — write
  messages without one; do not use `--no-verify` to work around it.
- Never force-push, never amend a commit already in history.
- Do not push to `origin` on either `main` or `gh-pages`.
- Before staging, `git status` for anything unexpected already present
  that isn't your own round's work.

## 8. Final report format

- **Closed this pass:** each item, one line, commit hash(es).
- **Reclassified/blocked:** anything from §5 that turned out to depend
  on operator presence after all — say which hard boundary it maps to.
- **Verification state:** tsc/lint/audit/both-builds status as of the
  final commit.
- **The candidate-test report:** where it lives, how many candidates,
  the top 2-3 by risk ranking, so the operator can act on it immediately
  without opening the file.
- **Exact next actions for the operator:** phrased as a checklist (e.g.
  "review docs/WRITE_PATH_TEST_CANDIDATES.md and pick the next field to
  test live," "push the gh-pages worktree's commit once reviewed").

## 9. Context a fresh agent won't otherwise have

- The fixture harness (`tools/screenshot-harness/`) is the only place UI
  work gets visually verified — the interactive browser pane's screenshot
  compositing has been unreliable in this environment; headless Chrome
  CLI against the harness (`chrome.exe --headless=new --window-size=...
  --screenshot=... URL`) has been the reliable fallback all session.
- `npx eslint .` (bare) has intermittently hit a permission-classifier
  block in this environment for no clear content-related reason; `npm
  run lint` (the project's own script, scoped to `src`) has been
  reliable throughout — prefer it.
- If two features end up touching the same shared file from concurrent
  work in the same (non-worktree) tree, do NOT just commit the tangle —
  split it: reset the file to HEAD, reapply one feature's edits in
  isolation, stage that, then restore the full working file before
  committing the other feature separately. This happened once already
  this project (SettingsPage.tsx, two features landed together) and was
  recovered cleanly this way with no work lost.
- `writeExclusion` and `readOnlyMode` are two independent gates — see
  `src/lib/write-guard.ts`'s own header comment. Don't conflate them in
  any research or documentation you write.
```

## Notes

- Deliberately smaller in scope than the 2026-07-31 1.0-readiness
  orchestrator prompt it follows — most of that prompt's work is done;
  padding this one out to match its size would mean inventing scope.
- The write-exclusion boundary in §2.3 is new relative to every prior
  pass's hard-boundary list. It exists because D-022 (the WPS live test)
  was preceded by an actual back-and-forth with the operator choosing the
  field and accepting the risk in the moment — that's a decision quality
  an unattended agent group re-running this prompt cannot reproduce, so
  the safe default is: research and propose, never arm.
- If the operator later wants a second, separate handoff for the 13
  deferred features (§4), that should be its own prompt with its own
  Definition of Done — post-1.0 feature work has a different risk/reward
  shape than closing out a release, and conflating the two prompts would
  blur that.
