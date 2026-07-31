# Non-Security Repository Audit — Handoff Prompt

## Prompt ID

`merlins_cloak_v2.handoff.non-security-audit.2026-07-31.v1`

## Purpose

A general, non-security audit of the whole repository — code quality and
consistency, architecture and tech debt, whether the project's own state
docs still agree with reality, and where the verification stack (tsc,
eslint, the fixture harness — there is no unit test suite) has blind
spots. This is explicitly NOT a security review; that is a separate,
already-established process for this project (`/code-review`,
`security-review`, the `claude-security` plugin) and this audit must stay
out of that lane entirely.

## Target Agent

**Single agent, full-capability model — do not route this through any
security-scoped skill, workflow, or agent type**, and do not let a
security-sounding word in scope ("audit") cause this to be picked up by
`claude-security` or downgraded to a lighter model tier. This is a plain
`general-purpose`-class single-agent session (or the equivalent in
whatever tool the operator runs it from), not a multi-agent workflow.

## How to run this

Paste the entire "Template" section below as the first message to a fresh
agent session. It has no memory of this conversation, so it re-derives
everything from the repo's own files, exactly like this project's other
handoffs.

## Template

```text
You are auditing Merlin's Cloak v2 (E:\Citadel\merlins_cloak_v2), an MV3
browser extension (WXT + React) that replaces the Asuswrt-Merlin router
web UI. You have no memory of any prior session. Everything you need is
in the repo's own files — read them before forming opinions.

## 0. What this audit is NOT

This is explicitly a NON-SECURITY audit. Do not do vulnerability hunting,
injection analysis, auth/permission review, or anything that belongs to
this project's separate security-review process. If you notice something
that looks security-relevant while reading, write ONE line for it under
an "out of scope, flag only" note and move on — do not investigate,
do not chase it, do not let it expand your scope.

## 1. Read first, to build context

- `README.md`, `STATUS.md`, `CHANGELOG.md` — project shape and history.
- `.raiden/state/{CURRENT_STATE,OPEN_LOOPS,DECISIONS}.md` — DECISIONS.md
  is a long, dated reasoning trail (D-001 through D-028 as of this
  writing); OPEN_LOOPS.md is the current authoritative backlog. Skim for
  pattern and gist, not word-for-word — the point is to know this project
  already tracks its own debt meticulously, so your job is to find what
  THAT process missed, not to re-derive what it already knows. Do not
  duplicate an existing OPEN_LOOPS entry as a "new" finding.
- `src/pages/types.ts` — the `SettingsPageDef`/`CustomPageDef` contract
  every page follows.
- Three page defs of increasing complexity, as the established pattern to
  measure consistency against (NOT generic best practices):
  `src/pages/defs/tools-tweaks.ts` (plain declarative page),
  `src/pages/defs/wireless.ts` (instance selector),
  `src/pages/defs/vpn-server.ts` (rule-list + instance selector combined).
- `tools/screenshot-harness/README.md` — the actual verification
  mechanism this project uses (no live router in CI, no unit tests).

This project has a distinctive engineering culture: rigorous, dated,
cross-referenced state documentation; a firmware-source-citation
discipline for every write path (every nvram key traced to a specific
`RAW/` file:line); and a hard safety architecture
(`src/lib/write-guard.ts`, `src/lib/write-policy.ts`) that every write
must flow through, with a `writeExclusion` category and
`confidence.write` tier on every page def. Judge quality and consistency
AGAINST that established culture, not against a generic checklist —
findings that ignore how this project actually works will read as noise.

## 2. Phase A — scope refinement (do this before the deep dive)

Given the size of this repo (~30 page-def files, ~60 write paths, an
extensive `.raiden/state/` history), do NOT start deep-diving
immediately. First produce a short, concrete scope-refinement note:

- A rough inventory: how many files in each of `src/pages/defs/`,
  `src/lib/`, `src/ui/` you'll actually need to read closely vs.
  spot-check vs. skip, and why.
- For each of the four areas in §3 below, 3-6 SPECIFIC things you intend
  to check (not "review code quality" — actual concrete checks, e.g.
  "compare how every instance-selector page's `derive()` handles a
  missing/empty instance value").
- Anything from OPEN_LOOPS.md / DECISIONS.md that already covers ground
  you were about to duplicate — name it and exclude it from your scope.

Write this note to `.audits/NON_SECURITY_AUDIT_SCOPE_<today's date,
YYYY-MM-DD>.md` before proceeding. If you are running with a human
present, this is a natural place to pause and let them glance at the plan
before you spend the rest of the budget executing it — say so explicitly
and wait a beat. If running unattended, proceed directly into Phase B
using your own scope note as the plan.

## 3. Phase B — the audit itself (all four areas, one final report)

### 3.1 Code quality & consistency

Across `src/pages/defs/*.ts(x)` (~30 files) and `src/lib/*.ts`: dead code,
unused exports, naming drift between similar constructs (do all
instance-selector pages template `{p}` the same way? do all rule-list
defs handle empty-string edge cases the same way? do all custom pages —
`clients.tsx`, `vpn-status.tsx`, `aimesh.tsx`, `notification.tsx`,
`certificates.tsx` — handle loading/error/empty states with the same
shape?), duplicated logic that could be a shared helper WITHOUT
over-abstracting three similar lines into a premature framework.

### 3.2 Architecture & tech debt

Where is the `SettingsPageDef`/`CustomPageDef` split straining — custom
pages reimplementing what the declarative renderer already does, or
declarative pages fighting the pattern with awkward `showIf`/`derive`
gymnastics? Is `src/pages/defs/index.ts`'s manual registration list
scaling reasonably at ~30 files? Any layering violation between `lib/`
and `pages/`? Is the `WriteEndpoint` vocabulary in
`src/lib/router-io.ts`/`write-guard.ts` (currently `'applyapp' |
'start_apply'`) accreting special cases? OPEN_LOOPS.md already has an
entry about extending it for dedicated-CGI writes — read that first, then
say whether your independent read agrees or disagrees with its framing,
rather than re-opening the question from scratch.

### 3.3 Docs & SOP consistency

Do `STATUS.md`, `CHANGELOG.md`, and `.raiden/state/*.md` actually agree
with each other and with the code? Spot-check: pick 6-10 specific,
checkable claims (page counts, which pages carry which `confidence` tier,
whether a described feature's file actually exists and matches its
description, whether a cited commit hash actually contains what it's
credited with) and verify each against the real `src/` state and `git
log`. Check `tools/screenshot-harness/README.md`'s claimed coverage
against what's actually fixtured in `mocks/fixtures.ts` and linked in
`index.html`. Flag drift, not just outright contradictions — a claim
that was true when written but has quietly rotted is exactly the kind of
thing this audit exists to catch.

### 3.4 Test/verification coverage gaps

This project has no unit test suite — `tsc --noEmit`, `eslint`, and the
fixture harness (visual, screenshot-based, manually captured) are the
only verification. What classes of regression would NONE of those three
catch? Find 4-6 CONCRETE, real examples in the actual code — not
hypothetical categories. Look especially at `buildFields`/`buildVerify`
pairs that could silently diverge from each other, `derive()` functions
decomposing joined nvram strings (off-by-one risk), and `showIf`
predicates that no harness fixture's data actually triggers (so the
branch has never been rendered, let alone verified).

## 4. Method — hard constraints

- Read-only. Do not edit, create, or delete any file except your two
  output files (the Phase A scope note and the Phase B report). Do not
  run any git command that changes state (`status`/`log`/`diff`/`show`
  are fine; nothing else). Never commit, never push.
- Do not crawl all of `RAW/` — it is large vendored reference source; only
  open the specific files this prompt or your own scope note already
  named.
- Every finding needs a concrete `file:line` citation and a one-sentence
  "why this matters" grounded in this specific project, not a generic
  best-practice statement.
- Rank findings within each of the four areas by actual cost to someone
  working in this repo — a docs-drift that would mislead a future
  session's starting assumptions outranks a cosmetic naming
  inconsistency, regardless of which "sounds" more serious.
- Be honest about severity. This project is unusually well-maintained for
  its size and history. Do not manufacture findings to pad the report —
  if a section has little to report, say so briefly and move on.

## 5. Output

- Phase A: `.audits/NON_SECURITY_AUDIT_SCOPE_<date>.md`
- Phase B: `.audits/NON_SECURITY_AUDIT_<date>.md` — one section per §3.1
  through §3.4, findings ranked within each section, each with
  `file:line` + why-it-matters. End with a short "if you only fix three
  things" synthesis across all four areas combined.

`.audits/` already exists in this project's conventions (prior third-party
security-audit reports live there) and is gitignored — writing here is
safe and does not require any git operation.

## 6. Final report format (to whoever is reading your output)

- **Phase A scope**, one paragraph: what you decided to check and what
  you deliberately excluded (and why).
- **Top findings per section** (§3.1-3.4), ranked, with citations.
- **The "if you only fix three things" synthesis.**
- **Anything you flagged as security-adjacent but did not investigate**
  (§0) — list it so it can be routed to the right process later.
- **What you could NOT assess** and why (time-boxed, out of read access,
  genuinely ambiguous) — do not silently skip something and imply
  coverage you didn't have.
```

## Notes

- This handoff was written after an earlier attempt to run the audit
  directly, mid-session, was intentionally stopped — the operator wanted
  a portable prompt to hand to a separate agent/window, not an in-session
  dispatch. If you are the one running this, that context doesn't matter
  to you; it's recorded here only so a future session understands why
  this file exists as a standalone handoff rather than as a completed
  audit report.
- The two-phase (scope-refine, then execute) structure is deliberate: a
  single agent given "audit everything" with no intermediate checkpoint
  tends to either boil the ocean or drift into whatever caught its
  attention first. Writing the scope note first, before the expensive
  pass, is cheap insurance against both.
- If a future pass wants to go bigger than one agent (a proper
  multi-agent fan-out — one finder per area, adversarial verification,
  etc.), that's a legitimate escalation, but it's a different prompt with
  a different risk/reward shape than this one. Don't silently upgrade
  this handoff into that; write a new one.
