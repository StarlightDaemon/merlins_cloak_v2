# Open Loops Correction Pass — Fable Orchestrator Handoff

## Prompt ID

`merlins_cloak_v2.handoff.open-loops-correction.2026-07-31.v1`

## Purpose

Two independent third-party non-security audits of this repo (a Gemini
3.1 Pro pass and a separate adversarial pass, both 2026-07-31) were
independently verified against source — the adversarial pass's two
headline findings were reproduced live in a running instance of the app,
not just read from code. Both passes' corrected, verified findings now
live in `.raiden/state/OPEN_LOOPS.md` under two dated sections:
"Non-security audit pass, new items (2026-07-31)" and "Adversarial
non-security audit pass, new items (2026-07-31)". This prompt hands off
the work of actually fixing what's fixable there, plus sweeping the rest
of `OPEN_LOOPS.md` for anything else genuinely solo-agent-completable that
hasn't been picked up yet.

This is a **correction pass**, not a feature pass — the two required
fixes are real correctness bugs (not stylistic/architectural nits), so
verification rigor matters more here than in a typical doc-cleanup pass.
Both required fixes come with exact reproduction recipes already recorded
in `.audits/NON_SECURITY_ADVERSARIAL_AUDIT_VERIFICATION_2026-07-31.md` —
use them to confirm the bug exists before touching code, and to confirm
it's gone after.

## Target Agent

**Claude Fable, orchestrating, using the `efficient-fable` delegation
pattern** (see that skill if the running agent has it available; the
essentials are restated in §6 below for one that doesn't). Fable's own
tokens are for: reading `OPEN_LOOPS.md` and deciding what's actually in
scope, reviewing subagent-proposed fixes against the two confirmed race
conditions' exact mechanics, resolving any shared-file conflicts between
parallel subagent edits, and the closing verification pass. Everything
else — reading fixture data, drafting a candidate patch, running the
harness repro script, running tsc/lint/build — is cheaper-tier work and
should be delegated, sub-delegating further if a slice is still
token-heavy (e.g. a full `OPEN_LOOPS.md` sweep for stale/duplicate items).

## How to run this

Paste the entire "Template" section below as the first message to a fresh
Fable session. It has no memory of this conversation or of either audit
pass; everything it needs is in the repo's own files, exactly like this
project's other handoffs.

## Template

```text
You are picking up Merlin's Cloak v2 (E:\Citadel\merlins_cloak_v2) to fix
two confirmed, reproduced correctness bugs and sweep the rest of the open
backlog for anything else solo-agent-completable. You have no memory of
any prior session. Everything you need is in the repo's own files — read
them before planning, and delegate the reading itself where it's
token-heavy rather than doing all of it yourself.

## 1. Read first

- `.raiden/state/{CURRENT_STATE,OPEN_LOOPS,DECISIONS}.md` — OPEN_LOOPS.md
  is the authoritative backlog; its two newest dated sections ("...pass,
  new items (2026-07-31)", both of them — the Gemini one and the
  adversarial one) are why you're here. Read those two sections in full
  yourself; you can delegate reading the rest of the (long) file to a
  subagent tasked with inventorying what's left open and solo-completable.
- `.audits/NON_SECURITY_ADVERSARIAL_AUDIT_VERIFICATION_2026-07-31.md` —
  the two required fixes' exact reproduction recipes (browser console
  scripts) and the specific line ranges implicated. Read this one yourself
  in full; it's short and everything downstream depends on understanding
  it correctly.
- `.audits/NON_SECURITY_AUDIT_VERIFICATION_2026-07-31.md` — companion
  verification for the other (Gemini) pass's findings, lower urgency.
- `src/ui/SettingsPage.tsx`, `src/ui/ListEditor.tsx` — the two files the
  required fixes touch. Read in full; both are a few hundred lines.
- `tools/screenshot-harness/README.md` — how to launch the fixture harness
  used to verify both fixes (`npx vite tools/screenshot-harness`,
  `/content.html#/openvpn-server` for 1A, `/content.html#/dhcp` for 1B).

## 2. Hard boundaries — unchanged from every prior pass, still absolute

1. No write of any kind may ever be submitted to a live router, by you or
   any subagent, for any reason. Everything here is verified against the
   fixture harness only.
2. No live browser/router session access, no authenticated session
   against a real router. `RAW/` is read-only reference.
3. Do NOT lift, modify, or propose lifting any `writeExclusion` tag on any
   page def — unrelated to this pass, and reserved for an operator-present
   conversation regardless.
4. Do not push to `origin`. Commit locally; pushing is a separate,
   operator-authorized step.
5. Do not touch `gh-pages`.
6. Stay inside what §4 and §5 below actually authorize. If the OPEN_LOOPS
   sweep in §5 turns up something operator-gated (needs live hardware, a
   design decision only the operator can make, a Chrome Web Store account,
   etc.), name it and leave it — do not silently expand scope to include
   it.

## 3. Definition of Done for this pass

- Both required fixes (§4) implemented, and independently re-verified
  against their own reproduction recipe (i.e. the bug no longer
  reproduces) — not just "code looks right," actually re-run the repro
  script from the verification report and confirm the corrected outcome.
- `npx tsc --noEmit` clean, `npm run lint` clean (prefer `npm run lint`
  over bare `npx eslint .` — the latter has intermittently hit an
  unrelated environment/permission issue in this project before).
- `npm run build` and `npm run build:firefox` both succeed.
- `.raiden/state/OPEN_LOOPS.md` entries for both required fixes updated
  to Closed, with the commit hash and a one-line note on the actual fix
  approach taken (match the file's existing style for closed entries).
- Any additional item picked up from the §5 sweep is either closed (same
  evidence standard) or explicitly left with its OPEN_LOOPS entry
  unchanged and a one-line reason why it turned out not to be
  solo-completable after all.
- A final report per §8.

## 4. Required work — the two confirmed, reproduced bugs

### 4.1 Instance-switch state corruption (`SettingsPage.tsx`)

Full detail, mechanism, and exact repro script:
`.audits/NON_SECURITY_ADVERSARIAL_AUDIT_VERIFICATION_2026-07-31.md` §2,
and the OPEN_LOOPS.md entry "Instance-switch state corruption" under the
adversarial-pass section.

In short: `load()` (`SettingsPage.tsx:125-158`) has no supersedure guard,
so an out-of-order async response from a superseded instance switch can
overwrite `baseline`/`values` after a newer instance's load already
rendered — the UI shows one instance selected while displaying another
instance's data, which `apply()` (`:194-261`) would then write to the
wrong instance's nvram keys via `expand()` (`:120-123`), which closes over
the *current* instance, not the one the displayed data actually came
from. The instance `RadioGroup` (`:277-284`) is also never disabled while
`busy` is true, unlike Revert/Apply beside it.

**Fix shape:** give `load()` a supersedure guard (an `AbortController` per
call, or a simple closure-scoped `active`/generation-counter flag that
no-ops the `setBaseline`/`setValues` calls if a newer `load()` has since
started) and add `disabled={busy}` to the instance `RadioGroup`. Verify
using the exact repro script in the verification report §2 — before your
fix, it reproduces the corruption (Server 1 selected, port shows 1195);
after your fix, switching the same way must leave the UI showing whichever
instance is actually selected with that instance's own data, every time,
regardless of response timing. Consider also testing a few different delay
values (e.g. delay the *fast* path instead of the slow one) to make sure
the fix isn't accidentally order-dependent in the other direction.

### 4.2 `ListEditor` rapid-deletion stale-closure loss

Full detail, mechanism, and exact repro script: same verification report
§3, and the OPEN_LOOPS.md entry "`ListEditor` rapid-deletion
stale-closure loss."

In short: `rows` (`ListEditor.tsx:52`) is memoized off the `value` prop;
`setCell`, `commit`, and each row's delete handler all close over that
render's `rows`. Two such handlers firing before an intervening commit
both compute against the same stale snapshot, so the second overwrites
the first's result.

**Fix shape, with a caution already flagged in the verification report:**
a `useReducer` alone does not fix this if the reducer is still dispatched
from a stale closure — the actual fix needs each mutating handler
(`setCell`, the delete `onClick`, `commitDraft`) to compute its next state
from the *latest* committed value at the moment it runs, not from a
snapshot taken at render time. A `useRef` mirroring the current `value`
prop (updated synchronously, read at click time instead of `rows`) is one
way; keying operations by a stable row identity against that ref instead
of a captured array index is another. Verify with the exact repro script
in §3 — before the fix, clicking delete on both fixture rows back-to-back
leaves 1 row; after the fix, it must leave 0, every time, not just when
timed generously. Also manually re-test normal (non-adversarial) usage —
add a row, edit a cell, delete a row, in the harness UI — to confirm
nothing about the fix broke ordinary single-step editing.

## 5. Sweep — anything else in OPEN_LOOPS.md that's solo-completable

Delegate this to a subagent: read `.raiden/state/OPEN_LOOPS.md` in full
and produce an inventory of every currently-open entry, classified as
either (a) solo-agent-completable right now, (b) operator-gated (needs
live hardware, a live browser session, a design decision reserved for the
operator, a GitHub push, a Chrome Web Store account — see the file's own
"Cross-reference: pre-existing, operator-gated loops" section for the
pattern), or (c) already informational/closed/no-action-needed. Do not
re-open anything already marked Closed or "accepted risk, not a defect"
(e.g. the `buildFields`/`buildVerify` duplication entry — that one is
deliberately not an actionable item).

From the (a) bucket, a reasonable additional target already identified in
the Gemini-pass section: **the custom-page loading/error shell
inconsistency** (5 files — `aimesh.tsx`, `wol.tsx`, `nettools.tsx`,
`traffic.tsx`, `dashboard.tsx` — early-return before the page title
renders, unlike the other 10 custom pages). It's mechanical, low-risk, and
its fix shape is already specified in that OPEN_LOOPS entry. Treat it as
a good second target if time/budget allows after §4 is done and verified,
not a requirement — §4 is the actual required work for this pass.

Do not treat the `ListColumnDef` `mapRead`/`mapWrite` enhancement (also in
the Gemini-pass section) as in scope — it's a real architectural change,
not a bounded fix, and the entry itself says so.

## 6. Delegation pattern (efficient-fable essentials, if the skill isn't loaded)

- Split independent work into subagents before reading everything
  yourself: one subagent for the OPEN_LOOPS.md sweep (§5), separate
  subagents for implementing and verifying 4.1 and 4.2 (they touch
  different files — `SettingsPage.tsx` vs `ListEditor.tsx` — so they can
  run in parallel).
- Give each subagent a self-contained handoff packet: repo path, exact
  objective, files in scope, the evidence to return (files touched, line
  refs, the repro script's before/after output, tsc/lint/build results),
  and a stop condition (if the fix isn't converging cleanly, or the repro
  script itself seems wrong, stop and report rather than improvising
  further).
- Cheaper-tier subagents are appropriate for: running the repro scripts,
  drafting the candidate patch for each fix, running verification
  commands, and the OPEN_LOOPS.md inventory sweep.
- Keep with yourself (Fable): deciding whether a subagent's reported "bug
  fixed" is actually true (reopen the file, re-run the repro script
  yourself before trusting it), resolving it if 4.1 and 4.2 land
  concurrently and something conflicts, and the final report.
- If 4.1 and 4.2 land concurrently and don't share a file, there's nothing
  to reconcile. If a shared-file conflict does happen for any reason
  (e.g. the §5 sweep also touches one of these files), the prior session's
  recovery pattern — reset to HEAD, reapply one change in isolation, stage
  it, restore the full working file, commit the other change separately —
  is recorded in `.raiden/local/prompts/solo-completable-remainder-handoff.md`
  §9 if needed.

## 7. Git and commit discipline

- Commit 4.1 and 4.2 separately (they're independent fixes to independent
  files) — small, atomic, in this repo's existing commit style (`git log`
  shows the pattern; no `Co-Authored-By` trailer, the commit-msg hook
  rejects it — do not use `--no-verify` to work around that or anything
  else).
- Commit the `OPEN_LOOPS.md` closure updates alongside each fix, not as a
  separate trailing commit.
- Never force-push, never amend a commit already in history.
- Do not push to `origin`.
- `git status` before staging anything, for context this prompt doesn't
  know about.

## 8. Final report format

- **Fixed this pass:** 4.1 and 4.2, each with commit hash, the fix
  approach actually taken, and the repro-script before/after result
  (paste both, don't just assert "fixed").
- **Sweep results (§5):** how many additional OPEN_LOOPS items were
  solo-completable, which (if any) were also closed this pass, and the
  classification breakdown (a/b/c counts) for anything not acted on.
- **Verification state:** tsc/lint/build status as of the final commit.
- **Anything reclassified or left open:** with the specific reason
  (operator-gated boundary hit, scope turned out larger than expected,
  etc.) — no silent drops.
- **Exact next actions for the operator**, phrased as a checklist.
```

## Notes

- This prompt exists because two independent audit passes converged on
  real findings this session, and the operator wants the fixable ones
  actually fixed by a follow-up pass rather than left as backlog prose —
  the correction is explicitly meant to happen via Fable orchestrating
  cheaper subagents, per the `efficient-fable` skill's delegation pattern
  (research/coding/testing to cheaper tiers, judgment/integration/final
  review kept at Fable), not as a single-agent slog.
- The two required fixes (§4) are deliberately narrow and each carries its
  own reproduction recipe precisely so a downstream agent doesn't have to
  re-derive "is this actually a bug" from first principles — that
  verification work already happened and is recorded in
  `.audits/NON_SECURITY_ADVERSARIAL_AUDIT_VERIFICATION_2026-07-31.md`.
- The §5 sweep is intentionally open-ended rather than a fixed list,
  because `OPEN_LOOPS.md` is a living document that may have changed
  between when this prompt was written and when it's run — trust the
  file over this prompt's summary of it.
