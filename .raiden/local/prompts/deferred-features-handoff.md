# All Deferred Features — Fable Orchestrator Handoff

## Prompt ID

`merlins_cloak_v2.handoff.all-features.2026-07-31.v1`

## Purpose

Implement all 13 previously-deferred features in one continuous,
autonomous, Fable-orchestrated pass. Selected in full by the operator on
2026-07-31 via a grouped questionnaire; full selection record and
reasoning in `.raiden/state/DECISIONS.md` D-025. This is post-1.0
feature-development work, independent of (and not a prerequisite for)
`.raiden/local/prompts/solo-completable-remainder-handoff.md`, which
covers separate, smaller release-closing items.

Work through the entire 13-feature backlog to completion in this pass.
Do not pause for routine check-ins, scope questions, or ordinary design
judgment calls — resolve those yourself and keep going. The only reason
to stop the whole pass is a genuine critical security issue, defined
precisely in §3.

## Target Agent

A Fable-tier (or equivalent top-capability) orchestrator. This is
explicitly not a "do it all yourself" task — the mandate is to plan,
then delegate every piece of research, implementation, and verification
work to whichever subagent type and model tier actually fits it, the
same way the 2026-07-31 1.0-readiness pass and its interactive
continuation operated (see `.raiden/state/CURRENT_STATE.md` and
`DECISIONS.md` D-001 through D-025 for that operating precedent — read
it before planning, it's the house style). Reserve your own top-tier
reasoning for planning, conflict resolution, merging concurrent work,
the closing verification pass, and judgment calls that actually need
it — not for typing code a well-briefed subagent can type just as
correctly.

## Template

```text
You are picking up Merlin's Cloak v2 (E:\Citadel\merlins_cloak_v2) to
implement 13 previously-deferred features in one continuous pass. You
have no memory of any prior session. Everything you need is in the
repo's own state files.

## 1. Read first

- .raiden/state/{GOALS,OPEN_LOOPS,DECISIONS,CURRENT_STATE}.md —
  DECISIONS.md D-001 through D-025 is the full reasoning trail this
  project runs on; D-025 specifically is why you're here.
- STATUS.md, CHANGELOG.md.
- docs/WRITE_PATH_CHARACTERIZATION.md — the reference standard for how
  a write path gets researched and documented in this project. Match
  its rigor for every new write path you create.
- .raiden/local/prompts/solo-completable-remainder-handoff.md — a
  separate, smaller handoff for release-closing work. Check whether
  it's already been run (git log will show); if not, it's independent
  of your scope here, don't duplicate it, don't feel obligated to run
  it either.
- Pick 2-3 existing SettingsPageDef examples of increasing complexity —
  a plain toggle page (e.g. src/pages/defs/tools-tweaks.ts), an
  instance-selector page (e.g. src/pages/defs/wireless.ts), and a
  ListEditor-based rule-list page (grep for `control: 'list'` across
  src/pages/defs/) — and read them as the pattern every new feature
  should match. New code should look like it always belonged here, not
  bolted on.

## 2. Absolute, structural boundaries — not judgment calls, a wall

These apply to you and every subagent you dispatch, for the entire
pass. They are not things to reconsider case by case:

1. No write of any kind is ever submitted to a live router, by you or
   any subagent, in any category, for any reason — including "just to
   verify the new feature works."
2. No live browser/router session access of any kind — no cookies, no
   authenticated session, no navigating to a real router admin UI.
   RAW/ (vendored GPL firmware source) is read-only reference; never
   modify it.
3. No `writeExclusion` tag is ever removed or weakened from an
   existing page. Every NEW write path this work creates ships WITH a
   `writeExclusion` tag (pick the closest existing category, or flag
   for the operator in your final report if none fits) and
   `confidence.write: 'unverified-write'` from the moment it exists —
   no new feature is ever born armed. This is the single rule that
   makes granting "work to completion without stopping" safe at all;
   treat it as non-negotiable.
4. No live-hardware verification, no Firefox live-testing, no Chrome
   Web Store submission, no push to `origin` — all operator-only, same
   as every prior pass in this project.
5. Certificate/key BLOB handling specifically: never write
   real-looking key/certificate material anywhere — not fixtures, not
   screenshots, not commit history, not logs. Use obviously-fake
   placeholder content, the same discipline already used for
   fictional IPs/MACs/SSIDs throughout this project's fixture harness.

If a feature's only reasonable implementation would require crossing
one of these, don't force it: implement everything short of that
crossing, document exactly what's blocked and why (the "reclassify,
log, move on" discipline this project already uses throughout
OPEN_LOOPS.md), and continue to the next feature. That is normal,
expected, and not a reason to halt the whole pass.

## 3. When to actually stop the whole pass

Only this — not scope uncertainty, not a design decision you're not
fully sure about, not a feature turning out bigger than expected, not
two subagents disagreeing (resolve that yourself; that's exactly the
kind of call this mandate expects of you). Stop only for a genuine
CRITICAL SECURITY ISSUE, meaning one of:

- You or a subagent discovers an actual, exploitable vulnerability in
  EXISTING code while working. Note what this is NOT: "this write path
  is unverified" is the project's normal, already-documented state for
  most of the codebase, not a security issue on its own. What DOES
  qualify: a real injection vector, a credential/secret being
  logged/exposed/persisted somewhere it shouldn't be, or a way the
  extension could be induced to act against a host other than the one
  the operator configured.
- A feature's only viable design would inherently require storing,
  transmitting, or exposing sensitive material (private keys, PSKs,
  passwords) in a way that breaks this project's standing privacy
  posture — "every request goes to the configured router address and
  nowhere else; nothing is retained beyond what's needed for the
  current session" (see docs/privacy-policy.md). Handling sensitive
  data carefully and correctly is expected and fine; there being no
  way to build a feature WITHOUT violating that posture is not.
- Anything that would require crossing one of §2's boundaries with no
  viable partial-implementation alternative.

When one of these genuinely happens: stop, document precisely what you
found and why it's disqualifying, and report to the operator.
Everything else — design choices, which existing pattern to follow,
how to scope a feature down to something buildable, whether two
features should share infrastructure — is yours to decide. Keep moving.

## 4. Definition of Done

- All 13 features (§5) are either implemented (read path + structural,
  excluded write path, harness-verified wherever there's UI), or
  explicitly logged as descoped/blocked with a specific reason tied to
  §2 or §3 — never silently dropped.
- Every new write path carries `writeExclusion` and
  `confidence.write: 'unverified-write'` — audit this explicitly across
  every new page def as a final check before calling the pass done, do
  not just assume you remembered every time.
- `npx tsc --noEmit` clean, `npm run lint` clean (prefer this over bare
  `npx eslint .` — the latter has intermittently hit an unrelated
  environment/permission issue in past sessions in this repo), `npm
  audit` still 0 vulnerabilities, both `npm run build` and `npm run
  build:firefox` succeed, current output in `.output/`.
- Every new UI surface is rendered and checked in
  `tools/screenshot-harness/` against fictional fixture data — extend
  its fixtures/mocks following its existing conventions (its README,
  and the SDN/dashboard fixture work already in there, are the
  pattern).
- STATUS.md, CHANGELOG.md, and .raiden/state/{OPEN_LOOPS,DECISIONS,
  CURRENT_STATE}.md all updated to reflect exactly what shipped, what
  was descoped, and why — matching this project's existing rigor
  (dated, specific, commit hashes, firmware-source file:line citations
  for every write path, exactly like the existing page defs and
  docs/WRITE_PATH_CHARACTERIZATION.md already do throughout).
- Everything committed locally, in small atomic commits, in this
  repo's existing style. Nothing pushed to `origin`.
- A final report per §8.

## 5. The 13 features

Recommended internal build order (build confidence and shared
infrastructure before the more novel/complex items) — a sequencing
suggestion for your own planning, not a checkpoint boundary. Keep
moving through the whole list regardless of order:

1. Dashboard dual-WAN aggregation (read-only; WAN card currently shows
   `wan0` only).
2. `Advanced_QOSUserPrio` — per-priority % allocation; refines the
   already-working QoS rules/limiter/classification pages.
3. Notification center — scope the read/write split yourself during
   research; likely mostly read.
4. SDN profile creation/editing — extends the SDN reader shipped
   2026-07-31 (`src/lib/sdn.ts`, `src/pages/defs/sdn.tsx` are your
   starting point).
5. Per-user Samba/FTP permissions (USB sharing views cover shares but
   not per-user grants).
6. Time Machine (USB-attached backup target config).
7. Download Master (USB download-station app).
8. AiMesh node management.
9. OpenVPN server client list — needs list-management UI; study
   `src/ui/ListEditor.tsx` first. VPN-category write-caution applies.
10. WireGuard server peers — same list-management shape as #9; touches
    `src/pages/defs/vpn-server.ts`, coordinate with #11.
11. Second WireGuard server instance — instance-selector extension of
    the existing WireGuard server def; coordinate with #10 since both
    touch the same file. Backend supports `WG_SERVER_MAX=2`; native UI
    and this project both currently expose only instance one.
12. Certificate/key BLOB handling — new interaction pattern; nothing in
    this codebase does file/BLOB upload yet. Research WebExtension
    file-input handling before designing. Broadest surface: spans
    multiple VPN and admin pages.
13. Operation Mode switching — its own micro-phase; see the note below.

**On Operation Mode switching specifically:** the actual danger here —
a mode switch reconfiguring the router in a way that drops the network
connection — is a LIVE-TESTING risk, and that's already fully contained
by §2.1: you will never submit a live write, for this feature or any
other. Implementing its read path and a structurally-excluded write
path is therefore not meaningfully more dangerous to BUILD than any
other item on this list. What it does deserve is the most thorough
firmware-source citation and the most explicit "here is exactly why
this is the highest-stakes item on the list" framing in your final
documentation, so that whenever the operator eventually considers
live-testing it, they have everything they need to be appropriately
careful. Build it with that in mind — don't hesitate to build it.

## 6. How to operate — delegate deliberately

- For each feature: dispatch a research step (firmware source
  analysis — exact nvram keys, endpoint, `action_script`, validation
  bounds, the same rigor as every existing page def's own header
  comments) before any implementation step. Use an Explore-type or
  general-purpose agent for this; reserve your own reasoning for
  reviewing what comes back and resolving conflicts, not for doing the
  grep-and-read yourself.
- Implementation: general-purpose subagents, Sonnet-tier, one feature
  (or one tightly-coupled pair, like #10+#11) at a time. Give each one
  the research findings, the pattern examples from §1, and §2.3's
  write-safety rule explicitly in its own brief — don't assume it will
  infer the write-exclusion requirement on its own; say it directly,
  every time.
- Anything touching shared files concurrently (multiple features
  editing the same page-def file, or anything touching package.json /
  wxt.config.ts / eslint.config.js) — worktree-isolate, merge it
  yourself, re-verify the integrated tree afterward. This project hit
  a real, recoverable file-conflict from skipping isolation once
  already (see CURRENT_STATE.md's note on the SettingsPage.tsx split
  during the interactive continuation) — isolate instead of repeating
  that where you can see it coming.
- Verification: a dedicated pass per feature or batch — don't trust a
  subagent's self-reported "tsc passed"; re-run it yourself against the
  integrated tree. Trust but verify, the same discipline every prior
  pass in this project has used.
- Batch for minimum round count wherever features are genuinely
  independent (most of §5's list, once past the shared-file
  coordination called out above); serialize or worktree-isolate only
  where there's real contention.

## 7. Git and commit discipline

- Commit each closed feature (or reasonably-sized sub-piece of one)
  separately, in this repo's existing style — small, atomic, specific;
  `git log` shows the pattern.
- This repo's commit-msg hook rejects `Co-Authored-By` trailers — write
  messages without one; never use `--no-verify` to work around it or
  any other hook failure — fix the underlying issue instead.
- Never force-push, never amend a commit already in history.
- Do not push to `origin`.
- `git status` before staging anything, to catch unexpected state that
  isn't your own work.

## 8. Final report format

- **Closed:** each feature, one line, commit hash(es), the confidence
  tier it shipped at (read: live-verified/structural; write: always
  `unverified-write` for anything new, per §2.3).
- **Descoped/blocked:** each feature not fully closed, mapped
  explicitly to the specific §2 or §3 boundary it hit — never a vague
  "ran out of scope."
- **Any critical security issue that halted the pass** (if one did):
  full detail — what triggered §3, exactly what state things were left
  in, what still needs the operator's attention.
- **Verification state:** tsc/lint/audit/both-builds status as of the
  final commit.
- **Delegation summary:** roughly how many subagents were used, for
  what kinds of work, and any coordination/conflict incidents plus how
  you resolved them.
- **Exact next actions for the operator:** what to review, whether
  anything is ready for a live-supervised test next (and which is the
  lowest-risk candidate to start with, mirroring how
  docs/WRITE_PATH_TEST_CANDIDATES.md — if it exists by the time you run
  this — already ranks the existing backlog), whether anything's ready
  to push.
```

## Notes

- Supersedes an earlier, smaller "run this as independent waves across
  separate sessions" framing that was being drafted for this same
  feature backlog before the operator's follow-up instruction
  (2026-07-31): one continuous pass, work to completion, delegate
  deliberately, stop only for critical security issues. See
  `DECISIONS.md` D-025's addendum for the record of that shift.
- This is a genuinely large undertaking — 13 features, several
  introducing new write-capable surfaces and one entirely new
  interaction pattern (file/BLOB upload for certificates and keys).
  Expect this to be a long session or a resumed one; nothing about
  "work to completion" implies it will be fast, only that it shouldn't
  need operator check-ins along the way.
- Full selection record and reasoning for which features are in scope:
  `DECISIONS.md` D-025.
