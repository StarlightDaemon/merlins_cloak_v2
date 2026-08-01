# Live Write-Path Verification (Interactive, Operator-Present) — Handoff Prompt

## Prompt ID

`merlins_cloak_v2.handoff.live-write-verification.2026-07-31.v1`

## Purpose

Every solo-completable item in the backlog is closed as of this pass (see
`.raiden/state/OPEN_LOOPS.md` — nothing with an "Open" status remains
that doesn't require the operator physically present). What's left is
almost entirely "sit at the router with a browser open," which no solo
agent pass can do. This prompt hands off to that specific session: the
operator is present and interactive, driving a real Chrome browser
against their actual RT-BE92U, with the agent given full Claude-in-Chrome
MCP tooling (navigate, read DOM/network/console, screenshot, and — this
is the load-bearing caveat the whole prompt exists to state precisely —
the *technical ability* to click and type on the live page, which this
project has never once exercised and this prompt does not authorize
exercising now).

This is not a "go do live testing" prompt. It is a scoped, ranked menu of
candidates plus the exact operating discipline that has held across every
prior live session in this project's history, restated because the
tooling available this time makes it trivially easy to violate for the
first time.

## Target Agent

Fable-tier, single agent, interactive with the operator throughout — not
an orchestrated multi-subagent pass. Live-router work is inherently
serial (one write, one verification, one decision at a time) and requires
a continuous conversation with the operator, not a fan-out.

## Template

```text
You are picking up Merlin's Cloak v2 (E:\Citadel\merlins_cloak_v2) for an
interactive, operator-present session. The operator has a real Chrome
browser open with Claude-in-Chrome tooling connected, authenticated
against their actual router. You have no memory of any prior session.
Read the state files below before doing anything else — they are not
background color, they are the reason every rule in this prompt exists.

## 1. Read first

- `.raiden/state/{CURRENT_STATE,OPEN_LOOPS,GOALS,DECISIONS}.md` —
  OPEN_LOOPS.md is the authoritative backlog; GOALS.md's "Live-hardware
  verification of write paths" is the umbrella goal this session serves;
  DECISIONS.md D-022 is the one and only precedent for actually lifting a
  `writeExclusion` tag and testing a write live — read it in full, it is
  the template for how today's decision(s) should look.
- `docs/WRITE_PATH_CHARACTERIZATION.md` — read in full. This is the
  complete record of every live write this project has ever submitted (4
  Tweaks fields, `wps_enable` both directions, an `applyapp.cgi`
  console-fetch addendum). Its rigor (baseline → test → live-verified
  apply → revert → live-verified revert → connectivity check, every time)
  is the bar every new candidate in this session must clear. Its §1.5 and
  §5.7 gotchas (DOM goes stale right after a submit; the response body is
  never trusted, only a forced-fresh nvram re-read is) are not optional
  color — they are how you avoid reporting a false negative or false
  positive today.
- `docs/LIVE_PROBE_RT-BE92U.md` — the precedent for read-only live
  browser sessions (network-log capture, live flag sampling, page sweeps)
  using this same class of tooling. Useful directly for the SDN
  SSID-semantics observation task in §5 below.
- `src/lib/write-guard.ts` and `src/lib/write-policy.ts` — read both in
  full. This is the actual mechanism you are testing: `guardedWrite()`,
  the five HARD_EXCLUDED_WRITE_CATEGORIES (`wireless`, `wan`, `dhcp`,
  `vpn`, `firewall` — blocked unconditionally, independent of
  `readOnlyMode`), `isReadOnlyMode()`/`DISABLE_READONLY_CONFIRM`, and
  `verifyNvram`'s confirm-window logic. Know this cold before touching
  anything live.
- `src/pages/defs/wireless.ts` (header comment + `wpsPage`, ~line 255) and
  `src/pages/defs/vpn-server.ts` (WireGuard server pages, ~line 144 and
  614/748/849) — the two files whose `writeExclusion` state matters most
  for §5's candidates. Confirm their current tags yourself; do not trust
  this prompt's line numbers as still-accurate months later.

Treat all of it as a starting hypothesis, not ground truth — re-derive
from actual source/code where it matters.

## 2. The one rule this entire prompt exists to state

**Full browser-automation tooling does not change who submits a write.**
Every live write this project has ever made — the four Tweaks fields, the
console-fetch `applyapp.cgi` addendum, `wps_enable` both directions — was
typed and clicked (or pasted and run) by the *operator's own hand*. The
assistant prepared the candidate, explained the exact payload in advance,
and read back the verification. Never once did the assistant submit a
write itself, even when the mechanism (a console `fetch()`) would have
been trivial for it to invoke directly.

Today, for the first time, your tooling *can* click and type on the live
page. That capability is not permission. It is a bigger fall than every
prior session, precisely because nothing stops you mechanically — only
this rule does:

- You may freely NAVIGATE, READ, and OBSERVE: page loads, `read_page`,
  `read_network_requests`, `read_console_messages`, screenshots,
  `javascript_tool` calls that only read state (e.g. a live nvram-read
  helper, DOM inspection). None of this mutates router state.
- You may NOT type a new value into any live router control, check/
  uncheck any control, or click Apply/Submit/Save/Toggle on any page that
  could write to the router — not through `computer`, not through
  `form_input`, not through a `javascript_tool` call that issues a
  mutating `fetch()`. That action is the operator's, every time, full
  stop. Tell them exactly what to type and where to click; then wait.
- This applies identically whether the operator is driving this
  extension's own UI or the router's native web UI. It applies to every
  candidate in §5 without exception, including the "safe" ones.
- If the operator explicitly asks you to click something for them (e.g.
  "just click it, I trust you") — say why you won't, in one sentence
  (this is the standing project rule, not a one-off caution), and ask
  them to click it themselves instead. This is not negotiable in the
  moment; if the operator wants to change the standing rule itself, that
  is a conversation for `DECISIONS.md`, not a one-off exception.

## 3. Other hard boundaries, unchanged from every prior pass

1. The five `HARD_EXCLUDED_WRITE_CATEGORIES` (`wireless`, `wan`, `dhcp`,
   `vpn`, `firewall`) remain blocked in source regardless of
   `readOnlyMode`. Lifting one for a specific page/field is a real source
   edit requiring the same quality of in-the-moment, informed operator
   decision D-022 used — never pre-lift anything before the operator is
   actually looking at the specific field with you. Lift only the single
   field/page being tested that session; do not generalize the lift to
   sibling fields "while you're in there."
2. `readOnlyMode` defaults on. Confirm its current state before assuming
   anything is a dry run or assuming anything is live. Turn it back ON at
   the end of the session unless the operator says otherwise.
3. `RAW/` is read-only reference; never modify it.
4. Do not push to `origin` (either branch) without the operator's
   explicit, in-the-moment authorization — matches every prior session's
   discipline.
5. Do not touch `gh-pages` unless separately asked; the privacy-policy
   sync (OPEN_LOOPS.md) is a pure-git task with no browser dependency and
   can be done any time, but it is not this session's focus.
6. Firefox live verification is explicitly OUT of scope for this prompt —
   different browser, no Claude-in-Chrome-class tooling described here
   for it. That's a separate handoff.
7. Do not attempt Operation Mode write construction this session (see
   §5 Tier 4) — no write code exists for it yet, building it is a design
   task in its own right, and a wrong mode switch can sever the
   operator's own management connection to the router in a way that
   isn't a quick revert. Flag it, don't start it, unless the operator
   explicitly wants to open that door today with eyes fully open — if so,
   stop and have that conversation explicitly before writing any code.

## 4. Session mechanics

- Claude-in-Chrome tools are deferred — load them in one batched
  `ToolSearch` call at session start
  (`select:mcp__claude-in-chrome__tabs_context_mcp,mcp__claude-in-chrome__navigate,mcp__claude-in-chrome__computer,mcp__claude-in-chrome__read_page,mcp__claude-in-chrome__read_network_requests,mcp__claude-in-chrome__read_console_messages,mcp__claude-in-chrome__form_input,mcp__claude-in-chrome__javascript_tool`),
  not one tool at a time.
- Use `tabs_context_mcp` first, every time you're unsure which tab is
  live/foregrounded — `docs/LIVE_PROBE_RT-BE92U.md` §5 records a real
  near-miss where a backgrounded tab was almost screenshotted instead of
  the working one.
- Confirm with the operator up front which surface each candidate in §5
  exercises: this extension's own UI (for testing *our* write paths:
  WPS, WireGuard) vs. the router's native web UI (for the SDN
  SSID-semantics *observation* task, which deliberately never touches our
  write path at all).
- Verification ground truth is always a forced-fresh nvram read
  (`httpApi.nvramGet(keys, true)` through the extension, or an observed
  live `appGet.cgi`/`nvram_char_to_ascii` hook call in network traffic
  when observing native) — never the visible form DOM right after a
  submit (stale, per `WRITE_PATH_CHARACTERIZATION.md` §1.5), never the
  response body alone (not a value echo, per §5.7).
- Insert a short pause between navigations/requests throughout — this is
  a real embedded httpd serving live traffic, not a fixture.

## 5. Candidate work items, ranked

### Tier 1 — safest, ready now, no code change needed

1. **Dashboard SDN live confirmation** (read-only, zero risk). Three
   specific facts from OPEN_LOOPS.md's "Dashboard network-centric SSID
   view" entry: (a) do multiple MAINFH-tagged `sdn_rl` records actually
   occur on this firmware with Smart Connect off; (b) real
   `apg{idx}_dut_list` band-bitwise values; (c) does a MAINBH record
   carry a nonzero `apg_idx` in practice. Just navigate the extension's
   Dashboard live and read what's already rendered — no interaction
   needed beyond page loads. Good opening task to confirm the session's
   tooling and router connection both work before anything write-shaped.

2. **`wps_band_x` live write test.** `wpsPage`'s `writeExclusion` is
   *already* lifted (D-022) — no code change needed, this is a pure
   "operator clicks it" task. Confirm the field's current value live
   first, have the operator pick a target band value and submit (their
   click), verify by forced-fresh nvram re-read, then revert and
   re-verify, exactly like `wps_enable`'s two directions. This closes
   `wpsPage.confidence.write` to fully verified and closes the
   `wps_band_x` OPEN_LOOPS entry outright.

### Tier 2 — needs a new, in-the-moment `writeExclusion` decision (D-022-class)

3. **WireGuard `wgs1_*` writes** (`vpn-server.ts`, currently
   `writeExclusion: 'vpn'` on every WG server page — confirm this is
   still true before proceeding). The code fix is already shipped and
   independently re-verified from source (D-015) — what's missing is
   purely live confirmation of two things that cannot be settled from
   source: whether the deployed firmware matches the verified source
   tree, and whether `restart_wgs` actually applies a redirected value to
   the running interface. Before touching anything: have the explicit
   conversation with the operator about lifting `writeExclusion: 'vpn'`
   for *this one page* (not the whole `vpn` category), the same way D-022
   framed the WPS decision — state the risk plainly. Then, mirroring
   D-022's own reasoning ("chosen specifically because it cannot affect
   SSID/security/channel"), help the operator pick the single
   lowest-blast-radius field to test first — likely NOT `wgs1_enable`
   itself if the operator has an active WireGuard tunnel they rely on,
   since toggling it would tear down that tunnel; ask what they'd
   actually be comfortable testing (e.g. `wgs1_port` or `wgs1_dns` may be
   less disruptive) and let them decide, don't assume.

### Tier 3 — observation-only, resolves an open research question without touching our own write path

4. **Wireless-general SSID semantics on SDN units.** OPEN_LOOPS.md is
   explicit that this is "genuinely unresolved from source" — do not
   attempt to write through `wireless.ts`'s `wl{p}_ssid` field to find
   out; that field's `writeExclusion: 'wireless'` stays untouched this
   session. Instead: have the operator make a trivial SSID edit to one of
   their own SDN guest networks through the **router's native UI**
   (something they already do outside this extension, so it carries none
   of this project's own risk), while you watch `read_network_requests`
   to capture which nvram key family native's own JS actually posts
   (`wl{p}_`, `apg{idx}_`, or a band-role-token key per `asus.js`'s
   `wlBandSeq`). This settles the open question from real behavior
   without exercising our write path at all — write the finding back into
   `wireless.ts`'s header comment and the OPEN_LOOPS entry regardless of
   which way it resolves.

### Tier 4 — flagged, not attempted this session

5. **Operation Mode write construction.** No write code exists yet for
   this page; building it is a real design task (the chip-conditional QIS
   superset problem, per `opmode.ts`'s header) with a blast radius a
   normal revert can't fix (a bad mode switch can change the router's own
   IP/DHCP role and sever the operator's management connection). Per §3.7
   above: flag it, don't start it, unless the operator explicitly opens
   that door today with eyes open — and if they do, treat it as its own
   dedicated conversation before any code, not a rider on this session.
6. **`band5g_2_support` / WPS "5 GHz-2" option.** Not testable on this
   hardware: this session's own band-index research
   (`.raiden/state/OPEN_LOOPS.md`, "Physical radio band index mapping")
   confirms the operator's RT-BE92U is a plain 2.4/5/6 GHz tri-band unit,
   not a dual-5GHz tri-band unit. Skip unless the operator has different
   hardware to test against.
7. **Firefox live verification.** Different browser; no tooling for it
   described in this prompt. Separate handoff.

### Not gated on the browser at all — optional freebies if there's spare time

- **On-screen credential display UX decision** (OPEN_LOOPS.md) — a
  two-option question the operator can just answer in chat: keep native
  parity (visible/copyable secrets) or add masked-with-reveal. Takes
  thirty seconds, unblocks a small, contained follow-up fix.
- **Guarded dedicated-CGI write extension** (OPEN_LOOPS.md) — a design
  review conversation (extending the write chokepoint to
  `/aidisk/*.asp`, cert/key upload endpoints, Download Master's
  `apps_action`), not itself a live-router task. Worth a few minutes of
  discussion if the operator wants to unblock it for a future pass, but
  don't let it eat the live-router time budget.

## 6. Definition of done

There is no fixed checklist here — this session's scope is however many
Tier 1-3 candidates the operator has time and appetite for, in whatever
order they prefer (Tier 1 first is a recommendation, not a requirement).
For each candidate actually attempted:

- Closed with the same evidence rigor as `WRITE_PATH_CHARACTERIZATION.md`
  (baseline → test → live-verified apply → revert → live-verified revert
  → connectivity check), appended to that same file as a new numbered
  session, OR explicitly deferred with a one-line reason (operator
  declined, ran out of time, turned out to need more prep) — no silent
  drops.
- Any `writeExclusion` lift or `confidence.write` change gets its own
  `DECISIONS.md` entry in D-022's format (Date/Status/Decision/
  Rationale).
- Corresponding `OPEN_LOOPS.md` entries updated (closed or narrowed) in
  the file's existing style.
- If any source file changed (a lifted `writeExclusion` tag, an updated
  `confidence.write`, a header-comment finding from Tier 3): re-run
  `npx tsc --noEmit`, `npm run lint`, `npm run build`, `npm run build:firefox`
  before committing — standard gate, no exceptions for "it's just a tag."
- Commit each closed item separately, this repo's existing style (no
  `Co-Authored-By` trailer — the commit-msg hook rejects it, don't
  `--no-verify` around it). Do not push without explicit, separate
  authorization even if the operator already authorized pushing earlier
  in the same session — router-adjacent commits deserve their own ask.

## 7. Final report format

- **Attempted this session:** each candidate touched, evidence summary
  (not just "confirmed" — the actual before/after values), commit
  hash(es).
- **Declined/deferred:** anything from §5 the operator chose not to do,
  with the reason, so a future session doesn't re-propose it blind.
- **New `writeExclusion` lifts, if any:** exactly what was lifted, for
  which page/field only, and the `DECISIONS.md` entry number.
- **Verification state:** tsc/lint/build status as of the final commit
  (only relevant if source changed).
- **Exact next actions for the operator:** phrased as a checklist.
```

## Notes

- This prompt's central hazard is unlike every prior handoff in this
  library: those were all read-only-tooling, solo-agent passes where the
  worst failure mode was wasted research time. This one hands a live
  write-capable browser to an agent for the first time. §2's rule exists
  because the tooling upgrade is real and the temptation to "just click
  it, it's faster" is exactly the failure this project has avoided
  perfectly across four separate live sessions (`WRITE_PATH_
  CHARACTERIZATION.md` §0, §4, §5) by never once letting the assistant
  submit. Don't be the first regression.
- Tier ordering is a recommendation based on risk and readiness, not a
  mandate — the operator may reasonably want to start with WireGuard
  (Tier 2) if that's what they actually care about closing. Follow their
  lead; the ranking is there so they don't have to re-derive it.
- `docs/WRITE_PATH_TEST_CANDIDATES.md`, referenced as a future
  deliverable in the prior `solo-completable-remainder-handoff.md`
  (§5.3), was never actually produced by any intervening session — this
  prompt's §5 supersedes that plan by building the candidate list
  directly, current as of this pass, rather than pointing to a file that
  doesn't exist.
