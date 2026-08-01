# Handoff — Merlin's Cloak v2, open-loop continuation (live Chrome available)

You are picking up Merlin's Cloak v2 (`E:\Citadel\merlins_cloak_v2`) for an
interactive, **operator-present** session. You have no memory of any prior
session. The operator has a real Chrome browser open, authenticated against
their live router, with Claude-in-Chrome tooling connected — and, unlike
most prior handoffs, **this extension is already loaded, enabled, and
rendering on the live router**, so you can see your own changes against real
data within one reload.

Written 2026-07-31 at the close of an operator-present live write session
that ran the previous handoff
(`.raiden/local/prompts/live-write-verification-handoff.md`) to completion.
That file is now spent — **this one supersedes it**; read it only for
historical method, not for candidate selection.

---

## 0. STOP — read this before your first tool call

**The read-only interlock is currently OFF.** It was disabled by the
operator for two authorized live write tests and never re-armed. The
extension's header badge shows only `227 flags`, with no `read-only`
badge — that is how you confirm it.

Consequences you must internalize before doing anything:

- Any Apply click in the extension right now sends a **real write** to the
  operator's live router. There is no dry-run safety net except the five
  hard-excluded categories.
- **Your first substantive act should be to ask the operator to turn
  read-only mode back ON** (popup toggle) unless the very first thing they
  want is another live write test. Do not proceed through unrelated work
  with the interlock disarmed just because it is convenient.
- You do not flip it yourself — it is in the extension's own UI, and
  changing the operator's safety posture is theirs to do. Ask; wait.

---

## 1. Read first (in this order)

- `.raiden/state/CURRENT_STATE.md` — its newest section ("operator-present
  live write session") is the immediate prior context: what was tested
  live, what shipped, what was deliberately left open.
- `.raiden/state/OPEN_LOOPS.md` — **the authoritative backlog**. Long
  (~1,180 lines) and full of CLOSED/RESOLVED entries retained for context;
  read the headings first (they carry status inline) and only dive into
  the ones you intend to work.
- `.raiden/state/DECISIONS.md` — **D-029, D-030, D-031 are the newest and
  most relevant**; D-022 is the template every `writeExclusion` lift has
  followed. Read all four in full before touching any write path.
- `.raiden/state/GOALS.md` — the "Live-hardware verification of write
  paths" goal and its updated tally.
- `docs/WRITE_PATH_CHARACTERIZATION.md` — every live write this project
  has ever made. **§6 (WPS band) and §7 (WireGuard) are new.** Its §1.5
  and §5.7 gotchas are load-bearing: the DOM is stale right after a
  submit, and the response body is never confirmation — only a
  forced-fresh nvram re-read is.
- `docs/LIVE_PROBE_RT-BE92U.md` — read-only live-probe precedent.
  **§9 is new** and is the template for observation-only work: how to
  watch native's own traffic with this extension disabled.
- `src/lib/write-guard.ts` and `src/lib/write-policy.ts` — read both in
  full. `guardedWrite()`, the five `HARD_EXCLUDED_WRITE_CATEGORIES`
  (`wireless`, `wan`, `dhcp`, `vpn`, `firewall` — blocked unconditionally,
  independent of `readOnlyMode`), `isReadOnlyMode()`, `verifyNvram`'s
  confirm window. Know this cold before any write work.

Treat all of it as a starting hypothesis. Re-derive from source where it
matters; line numbers in prose drift.

---

## 2. The one rule this project does not bend

**Full browser-automation tooling does not change who submits a write.**

Every live write in this project's history — the four Tweaks fields, the
`applyapp.cgi` console-fetch addendum, `wps_enable`, `wps_band_x`,
`wgs_addr`/`wgs_port` — was typed and clicked (or pasted and run) by the
**operator's own hand**. The assistant prepared the candidate, explained
the exact payload in advance, and read back the verification. The prior
session had full click/type capability and still never submitted a write.

- You may freely NAVIGATE, READ, OBSERVE: page loads, `read_page`,
  `read_network_requests`, `read_console_messages`, screenshots,
  `javascript_tool` calls that only read state. None of this mutates.
- You may NOT type into a live router control, check/uncheck a control, or
  click Apply/Submit/Save/Toggle on any page that could write — not via
  `computer`, not via `form_input`, not via a `javascript_tool` mutating
  `fetch()`. Tell the operator exactly what to type and where to click,
  then wait.
- This holds for the extension's UI **and** the router's native UI.
- If the operator says "just click it, I trust you" — decline in one
  sentence (standing project rule, not a one-off caution) and ask them to
  click. Changing the rule itself is a `DECISIONS.md` conversation, not an
  in-the-moment exception.

**Formatting rule the operator asked for explicitly:** any value they must
paste (field values, console commands) goes in its own fenced code block,
one value per block. They are copy-pasting on a second screen.

---

## 3. Other hard boundaries

1. The five hard-excluded categories stay blocked in source regardless of
   `readOnlyMode`. Lifting one for a specific page is a real source edit
   requiring the same in-the-moment, informed operator decision D-022 and
   D-030 used. **Lift only the single page/field being tested** — never
   generalize to siblings "while you're in there."
2. `readOnlyMode` defaults on and is currently OFF (see §0). Re-arm it at
   session end unless the operator says otherwise.
3. `RAW/` is read-only reference. Never modify it. (It now includes the
   `rc/` init-script trees — check there before calling an rc-layer
   question unanswerable.)
4. **Do not push to `origin`** without explicit, in-the-moment
   authorization. **There are currently 9 unpushed commits on `main`.**
   Router-adjacent commits deserve their own ask even if the operator
   authorized a push earlier in the same session.
5. Don't touch `gh-pages` unless separately asked.
6. Firefox live verification is out of scope here — separate handoff.
7. **Operation Mode write construction stays flagged, not started** — no
   write code exists, building it is a design task in its own right, and a
   wrong mode switch can sever the operator's own management connection in
   a way a quick revert can't fix. Only open that door if the operator
   explicitly does, eyes open, as its own dedicated conversation.

---

## 4. Session mechanics

- **Claude-in-Chrome tools are deferred.** Load them in ONE batched
  `ToolSearch` call at session start:
  `select:mcp__claude-in-chrome__tabs_context_mcp,mcp__claude-in-chrome__navigate,mcp__claude-in-chrome__computer,mcp__claude-in-chrome__read_page,mcp__claude-in-chrome__read_network_requests,mcp__claude-in-chrome__read_console_messages,mcp__claude-in-chrome__form_input,mcp__claude-in-chrome__javascript_tool`
- **Multiple browsers may be connected.** If `tabs_context_mcp` errors
  saying none is selected, you must call `AskUserQuestion` listing every
  connected browser plus the "open a confirmation screen in every
  extension" option — do not pick one yourself. Last session the operator
  chose the broadcast option and `switch_browser` connected to the browser
  named "construct".
- Use `tabs_context_mcp` whenever unsure which tab is live.
- Insert a short pause between navigations — this is a real embedded httpd.
- **Verification ground truth is always a forced-fresh nvram read.** The
  live read helper that worked all last session, run via `javascript_tool`
  in the router tab (REPL semantics — last expression is the result, no
  `return`):

  ```javascript
  const keys = ['wps_enable','wps_band_x'];
  const hooks = keys.map(n => `nvram_get("${n}")`).join('%3B');
  const r = await fetch(`/appGet.cgi?hook=${hooks}`, {credentials:'same-origin'});
  JSON.stringify({status: r.status, body: await r.text()})
  ```

  Use `nvram_char_to_ascii("k","k")` instead of `nvram_get("k")` for
  values that may contain non-ASCII or list separators (SSIDs, rule lists).
- **Harness:** `preview_start` with `{name: "screenshot-harness"}`
  (`.claude/launch.json`, vite on :5173). Fixture data is fictional and now
  mirrors the live router's structural quirks on purpose. Verify UI work
  there BEFORE asking for an extension reload. Note: the app mounts in a
  **shadow root**, so `get_page_text`/`read_page` see nothing — query via
  `javascript_tool` through `element.shadowRoot`. React needs a tick
  between a programmatic `.click()` and reading the result — split them
  into two calls.
- **Gate before every commit** (no exceptions, not even for "just a tag"):
  `npx tsc --noEmit`, `npm run lint`, `npm run build`, `npm run build:firefox`.
  Run them as **separate** PowerShell calls — chaining all four in one
  command line tripped the environment's permission classifier last
  session.
- **Commit messages:** use `git commit -F <file>` with a temp file. The
  repo's commit-msg hook rejects `Co-Authored-By` trailers (never
  `--no-verify` around it), and PowerShell here-strings mangled multi-line
  messages repeatedly.

---

## 5. Live state as of this handoff (verified, not assumed)

| Thing | State |
|---|---|
| Extension | **Enabled and rendering** on `http://192.168.1.1/SDN.asp` |
| Read-only mode | **OFF** — see §0 |
| Build in `.output/` | Current with `HEAD` (both Chrome and Firefox) |
| Router | RT-BE92U, Merlin 3006.102.7_2, reachable, ~9 ms nvram round-trip |
| Git | `main`, clean tree, **9 commits ahead of `origin/main`**, nothing pushed |
| Harness | Not running; start it yourself when needed |

Router facts worth not re-deriving: `wl0`=2.4G, `wl1`=5G, `wl2`=6G
(`wlnband_list` = `2g1<5g1<6g1`, live-confirmed). Smart Connect is ON. One
MAINFH record (`apg_idx` 1, apm pool), one MAINBH (`apg_idx` 2), LEGACY
guest = the operator's IoT network (`apg_idx` 1, apg pool — the pools'
index spaces overlap, which caused a real defect last session), plus a
disabled VPN profile (`apg_idx` 2). WireGuard **client** is active
(`wgc1_enable=1`); WireGuard **server** is unconfigured and off.

**Privacy note, carried forward deliberately:** the composite key
`apg{idx}_security` embeds the network's WPA passphrase in cleartext. Two
of the operator's passphrases entered the prior session's context through
it (once while probing structure, once inside a captured native payload).
No credential value was written to any file, commit, or doc, and the
operator was told both times. **Do not read `apg{idx}_security` unless the
task genuinely requires it**, and never write its value anywhere. If you
do see one, say so plainly and immediately.

---

## 6. Candidate work, ranked

The operator's own stated preference last session was "complete all of
them in strategic order from the beginning to the end." Nothing here is
mandatory; confirm the order with them.

### Tier 1 — solo-completable now, no router, no operator gating

1. **Router Status card layout — label-left / value-right.**
   Operator-requested from live observation. Today each field costs two
   lines (label stacked over value); they want `Firmware` left, version
   right, on one line, condensing the page. **Honor the standing overflow
   criterion**: atomic values never split mid-token, so long values (a
   3-address DNS list, IPv6) need a wrap strategy — value wraps whole
   tokens, or the pair falls back to stacked below a width threshold.
   Verify at ~960px and narrower in the harness. Decide (with them)
   whether it generalizes to other card-based status views.
   *Where:* `src/pages/defs/dashboard.tsx`, `src/theme/css.ts`.

2. **Revert-to-empty UI gap.** Surfaced live: a field whose nvram baseline
   is unset but whose def carries `validate.required` (e.g.
   `wgs{p}_addr`) cannot be returned to empty through the UI — blanking
   it trips validation and grays out Apply, because validation runs over
   every visible field regardless of dirty state. The WireGuard revert had
   to fall back to an operator-pasted console fetch. Firmware accepts
   empty values fine (`web.c:4750` `nvram_set(tmp, "")`), so this is a
   pure client-side expressiveness gap. Design questions are already
   written up in the loop — read them; the interaction with delta-write
   semantics (a cleared field must be posted as explicit empty, not
   dropped) is the subtle part.
   *Where:* `src/ui/SettingsPage.tsx`, `src/pages/types.ts`.

3. **`wl{p}_ssid` presentation on SDN units.** Residual from D-031: that
   field is now *confirmed* not to be the SSID write path on SDN firmware
   (it holds a 32-hex placeholder), yet the Wi-Fi Name & Security page
   still renders it as though it were the network name. Decide whether to
   hide it, annotate it, or redirect the user to the SDN page. Clarity,
   not correctness — its `writeExclusion` stays.
   *Where:* `src/pages/defs/wireless.ts` (header note 5 has the evidence).

4. **On-screen credential display UX decision.** A two-option question the
   operator can answer in chat in thirty seconds: keep native parity
   (secrets visible/copyable) or add masked-with-reveal. Given the
   passphrase exposure noted in §5, this is more topical than it was.
   Unblocks a small contained fix.

### Tier 2 — source research, no router needed

5. **SDN payload: three list keys we omit** (`vlan_trunklist`,
   `dhcpres1_rl`, `dot1_rl`). Native posts them on every SDN edit; we
   don't. All empty in the one capture, so the populated-case consequence
   is unknown. Determine each key's content model from `sdn.js`/`web.c`,
   then decide per key: round-trip verbatim like `radius_list`, or keep
   omitting deliberately. **Do not add them blind to a whole-table
   rewrite.**

6. **SDN `rc_service` is richer than our constant.** Native sent
   `restart_wireless;restart_sdn 4;restart_stubby;` for a plain SSID edit;
   we send static `restart_wireless`, and our own source-derived comment
   predicted only the first two. Work out when `restart_stubby` (DoT
   daemon) is appended — the edited profile had `dot_enable=1`, the
   plausible trigger, but one observation didn't isolate it — then make
   `SDN_RC_SERVICE` a function of the profile, as `WriteDef.rcService`
   already supports elsewhere (D-010's direction resolver is the pattern).

7. **`ListColumnDef` read/write mappers** — backlog refactor, well
   described in its loop. Genuinely optional.

### Tier 3 — needs the operator + live router

8. **WireGuard: does `restart_wgs` reach a running interface?** The
   explicitly-scoped follow-up to D-030, offered last session and
   declined. Requires briefly enabling a zero-peer WireGuard server
   (cryptographically inert — it drops everything not from a configured
   peer key — but it does open a WAN UDP port and generate server keys,
   which is real residue to clean up or document). The page's exclusion is
   already lifted, so no new lift is needed. Have the risk conversation
   explicitly; the operator has already declined once, which is a
   legitimate standing answer.

9. **More wireless write coverage.** `wpsPage` is fully verified; every
   other wireless page stays hard-excluded. Any further lift needs its own
   D-022-class conversation and should start from the lowest-blast-radius
   field available, never SSID/security/channel.

### Tier 4 — flagged, do not start

10. **Operation Mode write construction** — see §3.7.
11. **`band5g_2_support` / WPS "5 GHz-2"** — untestable on this hardware
    (plain 2.4/5/6 tri-band unit). Skip unless different hardware appears.
12. **Firefox live verification** — separate handoff.

### Not gated on the router
- **gh-pages privacy-policy sync** — pure git, no browser. Read D-018's
  concurrent-session warning first.
- **Guarded dedicated-CGI write extension** — a design-review conversation
  reserved for operator review, with a hard `;`-sanitization constraint
  already recorded. Don't let it eat live-router time.

---

## 7. Definition of done, per item

- Live write tests: same rigor as `docs/WRITE_PATH_CHARACTERIZATION.md`
  (baseline → operator submits → live-verified apply → revert →
  live-verified revert → connectivity check), appended there as a new
  numbered session. Record tooling failures honestly — §6 and §7 both
  document captures that were missed and why.
- Any `writeExclusion` lift or `confidence.write` change gets its own
  `DECISIONS.md` entry in D-022/D-030 format (Date/Status/Decision/
  Rationale), stating exactly what was lifted and for which page only.
- Corresponding `OPEN_LOOPS.md` entries closed or narrowed in the file's
  existing style — no silent drops. Anything the operator declines gets a
  one-line reason so a future session doesn't re-propose it blind.
- Source changed → full gate (§4) → commit each closed item separately.
- **Tell the operator explicitly when they need to reload the extension**
  (they asked for this in as many words). Reload = `chrome://extensions` →
  ↻ on Merlin's Cloak → reload the router tab.

## 8. Final report format

- **Attempted:** each candidate, evidence summary with actual before/after
  values (not "confirmed"), commit hashes.
- **Declined/deferred:** with reasons.
- **New `writeExclusion` lifts:** exactly what, for which page only, and
  the `DECISIONS.md` number.
- **Verification state:** tsc/lint/both builds as of the final commit.
- **Exact next actions for the operator**, as a checklist — and if
  read-only mode is still off at session end, that is item one.
