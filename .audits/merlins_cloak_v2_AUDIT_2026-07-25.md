# Repository Audit — `merlins_cloak_v2`

**Date:** 2026-07-25
**Commit audited:** `fc5bb83` (local `main`, working tree dirty — 3 modified files)
**Auditor scope:** read-only; no repository content, history, dependencies, or environment modified. Sole file created: this report.

---

## 0. Executive Summary

Merlin's Cloak v2 is a WXT + React Manifest V3 browser extension that replaces the AsusWRT-Merlin router admin web UI in place, running entirely inside a content script on the router's own origin. It is a solo-author project, two days old, at pre-release maturity (`0.9.0-beta.1`, never released).

**Actual source layout (confirmed by inspection, not assumed):** the project uses a **non-root `src/` layout** driven by `srcDir: 'src'` in [wxt.config.ts](wxt.config.ts). TypeScript source lives under `src/` (60 files); WXT entrypoints are at `src/entrypoints/` (`background.ts`, `content.tsx`, `popup/`); the manifest is **generated**, not static — its configuration is the `manifest:` factory inside root-level [wxt.config.ts](wxt.config.ts), with generated output present at `.output/chrome-mv3/manifest.json` and `.output/firefox-mv3/manifest.json`. `publicDir` is `src/public`. There is no root-level `manifest.json`.

**Maturity stage:** feature-complete pre-release with an explicitly incomplete verification story. 73 views registered, 49 write paths implemented, 1 of 49 ever live-submitted, Firefox never loaded against hardware.

### Finding counts by severity

| Severity | Count |
|---|---:|
| Critical | 1 (with 3 sub-items) |
| High | 3 |
| Medium | 6 |
| Low | 4 |
| Info | 5 |
| **Total** | **19** |

### Provenance table — what was and was not verified

| Check | Status | Detail |
|---|---|---|
| `git fetch --all --prune` | **verified** | Ran clean, exit 0. Remote reachable over SSH. Remote-tracking refs current. |
| Test suite execution | **not applicable — no test suite exists** | No `test` script in [package.json](package.json); zero `*.test.*` / `*.spec.*` files; no `vitest.config`, `jest.config`, or `playwright.config` anywhere in the working tree. The sanctioned execution gate had nothing to run. `timeout(1)` was confirmed available (`/usr/bin/timeout`), so the gate itself was not the blocker. |
| Static pre-screen of test config | **not applicable** | No test config to screen. |
| `npm audit --package-lock-only` | **verified** | Package manager confirmed as npm (`package-lock.json` present, lockfileVersion valid, no `yarn.lock` / `pnpm-lock.yaml`). Full severity summary captured; detail read for High and Critical entries only. |
| `npm outdated` | **verified** | 3 outdated direct devDependencies. |
| History secret scan | **partial — no dedicated scanner installed** | `gitleaks`, `trufflehog`, and `osv-scanner` are all absent from PATH. Fell back to a bounded manual `git log --all -S'<candidate>'` pass over 8 high-signal patterns (private-key headers, `asus_token=`, `http_passwd=`, `admin:`, `ghp_`, `sk-`). 7 patterns returned zero commits; the single `sk-` hit (`c534713`) was inspected and is a false positive — the literal string `skipped` inside a source comment. **This is a bounded pattern pass, not full-history entropy analysis.** |
| Working-tree secret scan | **verified** | Pattern grep across the tracked tree + untracked non-`RAW` files. No credential values found. |
| Router-credential exposure scan | **verified** | MAC, private-IP, session-cookie, and router-login patterns grepped across `src/`, `docs/`, and root docs. |
| CI pipeline definitions | **verified (as absent)** | `.github/workflows/` does not exist. No CI definitions anywhere in the working tree. |
| CI live status (`gh run list`) | **verified** | `gh` is authenticated. One run in history: *Dependabot Updates*, `main`, **success**, 2026-07-24T20:19:08Z. No project-authored pipeline has ever run. |
| Remote repository state (`gh repo view`) | **verified** | Contradicts a load-bearing premise — see F2. |
| Built-manifest inspection | **verified** | Both generated manifests read from `.output/`; cross-checked against the `wxt.config.ts` factory. |
| `tsc --noEmit` / `eslint` | **not verified — outside the sanctioned execution gate** | The gate sanctions the test suite only. Lint/typecheck cleanliness is asserted by [STATUS.md](STATUS.md) and was not independently confirmed. |
| `RAW/` content scan | **partial — deliberately bounded** | `RAW/` is 4.5 GB / ~16,300 files of third-party firmware source. Mapped structurally (directory layout, nested `.git` presence, license-file presence) rather than content-scanned; a full grep would have produced tens of thousands of matches from vendored C and JS with no audit signal. |

---

## 1. Identity

**What it is.** A Manifest V3 browser extension that mounts a React application inside a Shadow DOM on the AsusWRT/Asuswrt-Merlin router admin pages, hides the native page underneath, and re-implements 73 admin views against the router's own `appGet.cgi` / `applyapp.cgi` HTTP API. It is a client-side replacement UI, not a proxy or a service — every router request is a same-origin `fetch` from the content script riding the browser's existing authenticated session cookie.

**Who it is for.** Owners of ASUS routers running Asuswrt-Merlin — realistically, on the evidence in [README.md](README.md), owners of the author's exact model. It is a successor to a v1 userscript by the same author.

**Entry points** (all under `src/entrypoints/`, per `srcDir: 'src'`):

| Entry point | File | Role |
|---|---|---|
| Content script | [src/entrypoints/content.tsx](src/entrypoints/content.tsx) | The only context that talks to the router. Guards on host, path, and page-shape before mounting; refuses login/QIS/upgrade/recovery flows. |
| Background service worker | [src/entrypoints/background.ts](src/entrypoints/background.ts) | Never issues a router request by design (documented Local Network Access constraint). Registers the dynamic content script for a custom address; runs the MAIN-world `*_support` flag collector on request. |
| Popup | [src/entrypoints/popup/main.tsx](src/entrypoints/popup/main.tsx) → `App.tsx` | Router address entry, optional-permission request, read-only interlock toggle. |

**Architecture beneath the entrypoints.** `src/lib/` holds the I/O and policy layer ([router-io.ts](src/lib/router-io.ts), [write-guard.ts](src/lib/write-guard.ts), [settings.ts](src/lib/settings.ts), [capabilities.ts](src/lib/capabilities.ts), plus parsers). `src/pages/defs/` holds 28 category modules declaring 73 page definitions against the contract in [src/pages/types.ts](src/pages/types.ts). `src/ui/` holds the shell and the generic declarative renderer [SettingsPage.tsx](src/ui/SettingsPage.tsx). `src/theme/` carries the Fujin token set inherited from v1.

**How it builds.** WXT 0.20.x with `@wxt-dev/module-react`. `npm run build` → Chrome MV3; `npm run build:firefox` (`wxt build -b firefox --mv3`) → Firefox MV3. Node pinned to 22 via [.nvmrc](.nvmrc). `postinstall` runs `wxt prepare`.

**Browsers targeted.** Chrome (MV3 service worker) and Firefox (MV3 event page via `background.scripts`, plus a `browser_specific_settings.gecko` block with an explicit `data_collection_permissions: { required: ['none'] }` declaration). Both build outputs are present and current in `.output/`.

---

## 2. Current State

- **Version:** `0.9.0-beta.1` in [package.json](package.json). Chrome manifest ships `version: "0.9.0"` + `version_name: "0.9.0-beta.1"`; Firefox manifest ships `version: "0.9.0-beta.1"` directly. **Version declarations are consistent** across `package.json`, both generated manifests, [CHANGELOG.md](CHANGELOG.md), and [STATUS.md](STATUS.md).
- **Branch:** `main`, tracking `origin/main`, **46 commits ahead, 0 behind**.
- **Last commit:** `fc5bb83`, 2026-07-25 12:17:44 -0600.
- **First commit:** 2026-07-24 14:18:46 -0600. **The entire repository is 53 commits over ~22 hours.**
- **CI/CD pipeline health:** there is no project-authored pipeline. `.github/workflows/` does not exist. The only run in the remote's history is a GitHub-managed *Dependabot Updates* job (success, 2026-07-24). No build, typecheck, lint, or test has ever run in CI. There is therefore no green-remote/red-local or red-remote/green-local divergence to report — there is simply no pipeline.
- **What works** (per operator-confirmed live observation recorded in [STATUS.md](STATUS.md), not agent-verified in this audit): Chrome mount and DOM takeover against a live RT-BE92U, identity detection, capability collection (227 `*_support` flags), read path across Dashboard/Clients/SDN/DHCP/logs/traffic/sysinfo/VPN-status/tweaks/diagnostics, console clean across ~23 navigations.

### Declared-state reconciliation

The repository carries a **partial governance layer**: [STATUS.md](STATUS.md) is an explicit "resumable state of record," supported by [CHANGELOG.md](CHANGELOG.md), a 9-document `docs/` corpus including [CURRENT_STATE_AUDIT.md](docs/CURRENT_STATE_AUDIT.md) and [LICENSE_AUDIT.md](docs/LICENSE_AUDIT.md), and a decision-bearing proposal document ([NAV_TAXONOMY_PROPOSAL.md](docs/NAV_TAXONOMY_PROPOSAL.md)). There is **no `.raiden/` directory, no `AGENTS.md`, no `CLAUDE.md`, and no `OPEN_LOOPS.md` / `DECISIONS.md` convention.** Open loops live as numbered prose in `STATUS.md §Known open items`.

Reconciled item by item:

| Declared | Actual | Verdict |
|---|---|---|
| "73 views registered (50 declarative settings pages, 23 custom React pages)" | `kind: 'settings'` = 50, `kind: 'custom'` = 23 | **Accurate** |
| "46 settings-page write paths implemented (plus WOL wake and Site Survey rescan)" | 46 `write: {` blocks in `src/pages/defs/`; 2 `guardedWrite` calls in [wol.tsx](src/pages/defs/wol.tsx), 1 in [site-survey.tsx](src/pages/defs/site-survey.tsx) = 49 total | **Accurate**, and consistent with CHANGELOG's "48 of the 49" |
| "Read-only interlock default: verified already correct… `DEFAULT_SETTINGS.readOnlyMode = true` (settings.ts:21) and `let readOnly = true` (write-guard.ts:47)" | [settings.ts:21](src/lib/settings.ts:21) and [write-guard.ts:47](src/lib/write-guard.ts:47) both confirmed exactly as stated, including the `getSettings()` catch path returning defaults | **Accurate** — the *default* is genuinely correct on both layers. This is a narrower claim than "hard-excluded categories cannot be written," which does **not** hold (F1). |
| "Hard-excluded categories are tagged per-def (`writeExclusion`) and shown in Diagnostics" | Literally true and precisely worded: they are *tagged* and *shown*. The tag is never *enforced*. | **Accurate as written; materially misleading in effect** — see F1 |
| LICENSE — MIT, with RAW/ and ASUS/Merlin name scope note | [LICENSE](LICENSE) is MIT, © 2026 StarlightDaemon; scope note present; `package.json` declares `"license": "MIT"` | **Reconciled — consistent** |
| ASUS/Merlin non-affiliation disclaimer | Present as a dedicated README section ([README.md:23](README.md:23)) and as an About card in the Extension Settings view | **Reconciled — present in both docs and code** |
| Hardware-compatibility claims | [README.md](README.md) separates live-verified (RT-BE92U only), structural-only (RT-AX88U, never contacted), out-of-scope (ROG/GT), and untested (stock). [docs/GETTING_STARTED.md:31-37](docs/GETTING_STARTED.md:31) says the same in end-user language. Code backs this: `classifyGeneration()` in [capabilities.ts](src/lib/capabilities.ts) handles exactly the two declared firmware families and returns `'unknown'` otherwise. | **Reconciled — accurate and appropriately hedged** |
| "Nothing pushed; all commits local for operator review" (§ line 49) and "Nothing has been pushed to origin; all commits are local, held for operator review" (§ line 91-92) | `origin/main` = `58a006e` **is an ancestor of local `main`**. `gh repo view`: repository is **PUBLIC**, created 2026-07-24T19:35:55Z, last pushed 2026-07-25T00:04:53Z. 30 files are already published. | **CONTRADICTED — see F2** |

---

## 3. Git State & History

> **All findings in this section are VOLATILE** — git state is point-in-time and must be re-verified before any action is taken on it.

**Uncommitted (3 modified, tracked):**

| File | Change |
|---|---|
| [wxt.config.ts](wxt.config.ts) | +15/−9. **Functional.** Changes `version:` from unconditional `VERSION_CORE` to a browser-conditional expression that ships the full `0.9.0-beta.1` semver string in the **Firefox** manifest. This alters a shipped release artifact. |
| [STATUS.md](STATUS.md) | +6/−2. Documentation of the above. |
| [package-lock.json](package-lock.json) | +4/−2. |

`.output/firefox-mv3/manifest.json` already carries `"version":"0.9.0-beta.1"` — i.e. **both build outputs in `.output/` were produced from the uncommitted working tree, not from `fc5bb83`.**

**Staged:** none.
**Stashes:** none (`git stash list` empty).
**Unpushed:** **46 commits** (`git log --branches --not --remotes` = 46).
**Unpulled:** none — `git log main..origin/main` = 0; `origin/main` is a strict ancestor. No divergence, no rebase hazard.
**Branches:** `main` only, locally and remotely. No feature branches, no detached work.
**Line endings:** git emits `LF will be replaced by CRLF` warnings on all three modified files — a Windows checkout with no `.gitattributes` normalization. Cosmetic, but it means every future touch of these files risks whole-file diffs.

**History shape:** 53 commits, 2026-07-24 → 2026-07-25, all within 12 months (all within 22 hours). `git shortlog -sn` returned **no output** — worth noting as an oddity; commits carry author metadata (git user is `StarlightDaemon`) but the shortlog aggregation produced nothing under this environment. Not treated as a finding.

**Commit-message trustworthiness:** messages were checked against content, not taken at face value. The recent compliance-pass commits (`fc7cbf2` MIT LICENSE, `5e28d35` disclaimer + hardware claims, `c332e8d` version + CHANGELOG, `970c43f` getting-started, `fc5bb83` compliance/interlock status) all deliver what they claim. `fc5bb83`'s claim of "interlock default verified" is accurate for the *default* and does not claim enforcement of the exclusion categories.

### Untracked file classification

| Path | Size | Classification |
|---|---|---|
| `.claude/` | 1 file | **Tool directory** (expected). Ignored via the user's *global* excludes file (`~/.config/git/ignore`), **not** by the repo's own `.gitignore`. |
| `.serena/project.local.yml` | 5 lines | **Tool directory** (expected). Ignored by `.serena/.gitignore` (which is itself tracked and published). |
| `.audits/` | this report | **Tool directory** (expected). Created by this audit. Not ignored — see F16. |
| `.output/` | 2 build targets | **Orphaned artifact** — build output. Gitignored. Currently stale relative to `HEAD` (built from uncommitted source). It can be deleted, committed, or left as-is; this audit does not choose. |
| `.wxt/` | generated | **Tool directory** (expected). Gitignored. WXT's generated type/config scaffold. |
| `node_modules/` | — | **Tool directory** (expected). Gitignored. |
| `RAW/` | **4.5 GB, ~16,300 files** | **Ambiguous — flag for the operator.** See F13. Gitignored and deliberate per `.gitignore` ("Firmware source acquisition"), but it is 99.5% of the working tree by file count and contains two nested `.git` clones. |

The disk/git delta is stark: **16,471 files on disk (excluding `node_modules`) vs 82 tracked files.** ~16,300 of that delta is `RAW/`.

---

## 4. Open Loops

**Discovered (grep-based):** the codebase is almost entirely free of inline debt markers. A repo-wide `TODO|FIXME|HACK|XXX|BUG` grep across `src/`, `docs/`, and root files returned **exactly one match**, and it is a false positive — `generateXXX()` in a prose comment at [src/pages/defs/wireless.ts:44](src/pages/defs/wireless.ts:44). A `skip|xfail|it.skip|describe.skip|test.skip` grep over the source returned no test-skip markers (there are no tests to skip); the only substantive `skip` occurrences are `// skip unreadable global` catch-block comments in the flag collectors and one `skipped` in a design-rationale comment.

This is **not** evidence of low debt. It is evidence that **open loops are tracked exclusively in prose in [STATUS.md](STATUS.md)**, with no anchor in the code they refer to (F17).

**Declared (STATUS.md § "Known open items / deferred", 7 numbered items):**

1. Live verification pass, both browsers — blocked on operator loading unpacked builds. *(Partially closed: Chrome was subsequently verified per STATUS §line 63. Firefox remains open and is stated as such in three separate places.)*
2. Wireless band-token question — defs post canonical `wl{N}_*` keys; native page's own JS posts band-role tokens (`2g1_*`). "Confirm live before any wireless write is ever cleared."
3. `wgs1_*` WireGuard-server direct-prefixed writes — no `validate_instance` branch found; flagged as a leap of faith in [vpn-server.ts](src/pages/defs/vpn-server.ts).
4. `ipsec_profile_2` regeneration not reproduced.
5. `rcService` cannot branch enable→restart vs disable→stop.
6. Large deferred feature list (SDN profile editing, Samba/FTP per-user permissions, OpenVPN client lists, WireGuard server peers, cert/key BLOBs, Operation Mode, Time Machine, Download Master, AiMesh, notification center, `Advanced_QOSUserPrio`).
7. Dashboard WAN card shows `wan0` only.

**Cross-reference:** declared items 2 and 3 are the *reason* the wireless and VPN write paths are hard-excluded — which makes F1 the direct contradiction of those two open loops. Item 2 says in terms: "Confirm live before any wireless write is ever cleared." The code contains no mechanism that would prevent a wireless write from being sent.

**Additional discovered loop not in the declared list:** [STATUS.md](STATUS.md) line 127-132 records that `wl0_ssid` holds a 32-hex placeholder on SDN-managed ASUSWRT 5.0 units, with the real SSID in `sdn_rl` — and states "display/edit semantics on SDN units need a supervised write session before any wireless write is ever cleared." This is a third independent reason the wireless write path is unsafe, and it is recorded under "Findings from the live pass (all fixed in-session)" — where it is **not** fixed; only the Dashboard *read* was fixed.

**Commented-out code / half-wired features:** no commented-out code blocks of substance were found. Two genuinely half-wired items exist and are honestly documented in code comments: `start_apply` support in [router-io.ts](src/lib/router-io.ts) is fully implemented but "no def uses it" (dead but deliberate, retained as a documented alternative endpoint); and the inline-`<script>` MAIN-world flag collector in [capabilities.ts:94](src/lib/capabilities.ts:94) is a fallback that was live-observed to be silently dropped on the target firmware — retained, unreachable in practice on the only tested hardware, and carrying its own security weakness (F8).

---

## 5. Code Quality & Structure

**Architecture.** The design is unusually disciplined for a two-day-old repository and its central ideas are sound:

- **Single-context I/O.** All router traffic is confined to the content script, in the router's origin. The background worker is documented as never issuing a router request, and the code honors that — it uses only `scripting`, `permissions`, `storage`, and `runtime` APIs. The rationale (Local Network Access silently gating public→local requests from a `chrome-extension://` origin) is specific, correct, and load-bearing.
- **Single write chokepoint.** Every write is meant to pass through `guardedWrite()` in [write-guard.ts](src/lib/write-guard.ts). Verified: all 4 call sites across `src/` go through it; `submitBuiltWrite` is called from nowhere but the guard.
- **Build-then-maybe-send.** `buildWriteRequest()` is pure and separate from `submitBuiltWrite()`, so the dry-run preview shows the byte-identical request that would be sent. This is the right shape for an interlock.
- **Response bodies are never trusted.** `verifyNvram()` polls forced-fresh nvram re-reads as the sole confirmation. This is correct for the hardware and is consistently applied.
- **Declarative page contract.** 50 of 73 views are data, not code, rendered by one generic renderer. The `{p}` instance-template mechanism (expansion only at the I/O boundary) is cleanly factored.
- **Capability-gated rendering.** Nothing is shown that the router doesn't report supporting; verified working live (`nfsd_support = 0` correctly hid NFS).

**Smells and debt hotspots:**

- **Policy metadata that looks like policy enforcement.** The `writeExclusion` field is the single most consequential structural defect (F1). `src/pages/types.ts` documents it as "Hard-excluded live-write categories from the operator's scoping" — the language of a control — while the type is consumed in exactly one place: a red `Badge` in the Diagnostics view.
- **`readOnly` as module-scope mutable state.** [write-guard.ts:47](src/lib/write-guard.ts:47) holds `let readOnly = true` per JavaScript context, synchronized into the content script's copy by a `useEffect` in [App.tsx:75-85](src/ui/App.tsx:75). It fails *closed* (default `true`, set only after settings resolve, and re-synced on `storage.onChanged`), so the current wiring is safe. But the safety property depends on a React effect in the UI layer rather than on the guard reading storage itself — the interlock is one refactor away from being wired wrong, with no test to catch it.
- **Size outliers in the page defs.** [vpn-server.ts](src/pages/defs/vpn-server.ts) (28 KB), [wan.ts](src/pages/defs/wan.ts) (27.8 KB), [admin.ts](src/pages/defs/admin.ts) (27.4 KB), [vpn-client.ts](src/pages/defs/vpn-client.ts) (25.8 KB), [wireless.ts](src/pages/defs/wireless.ts) (23.3 KB). Mostly declarative data with dense rationale comments, which mitigates it, but these are large single files.
- **Tolerant JSON parsing with a sanitize-and-retry fallback** ([router-io.ts:54-71](src/lib/router-io.ts:54)) — pragmatic and correct for the firmware's malformed responses, explicitly never `eval`, but it is a hand-rolled parser path with zero test coverage.
- **Regex-based host extraction repeated in three places** ([background.ts:20](src/entrypoints/background.ts:20), [content.tsx:33](src/entrypoints/content.tsx:33), popup `saveAddress`) rather than shared. Each strips scheme and path with the same two `.replace()` calls. Divergence risk on a security-relevant code path.

**Test-coverage state — confidence: NONE.**

There is no test suite. Not a thin one — none.

| Measure | Value |
|---|---|
| Source files (`src/`) | 60 (54 `.ts`/`.tsx`) |
| Source volume | ~350 KB / ~12.5k lines |
| Test files | **0** |
| Test volume | **0** |
| Test runner configured | **none** |
| `test` script in `package.json` | **absent** |
| Coverage tooling | **none** |

The source-to-test ratio is undefined because the denominator is zero. This is the maximum possible imbalance, and there is no passing suite to weakly reassure against it. Every correctness claim in this repository rests on (a) TypeScript's type checker, (b) ESLint, and (c) one operator's manual observational pass against one physical router. The nvram rule-list codec ([rulelist.ts](src/lib/rulelist.ts)), the parental-control 12-char schedule token encoder, the IPSec `<username>password>ver` sharded-list merge/split, the traffic hex-literal parser, and the write-payload builder are all pure, deterministic, easily testable functions handling encodings that were reverse-engineered from firmware C source — and none of them has a single assertion behind it.

**Documentation state.** Genuinely strong, and unusually honest — the docs repeatedly downgrade their own claims (`structural` vs `live-verified`, "educated guess," "Don't."). [README.md](README.md), [docs/GETTING_STARTED.md](docs/GETTING_STARTED.md), and [CHANGELOG.md](CHANGELOG.md) are accurate against the code on every claim checked except the push status (F2) and the practical implication of "hard-excluded" (F1). Setup and run instructions match the actual scripts in `package.json` and the actual entrypoint layout. The `docs/` corpus (~250 KB across 9 files) documents the reverse-engineering provenance for essentially every nvram encoding the code implements — this is the repository's strongest asset and directly compensates for the missing tests as a source of reviewability, though not as a source of regression protection.

---

## 6. Security & Compliance

### Secrets — working tree

**Clean.** A repo-wide pattern grep (`api_key|secret|token|passwd|password|BEGIN … PRIVATE KEY`) across the tracked tree and untracked non-`RAW` files returned 158 lines, **all of which are identifiers, nvram key names, UI labels, or prose** — e.g. `vpn_client{p}_password` (an nvram key template), `control: 'password'` (a form control type), `rc_support token` (firmware terminology), `asus_token` inside a login-page *detection regex* at [router-io.ts:45](src/lib/router-io.ts:45). **No credential value appears anywhere in the working tree.** No `.pem`, `.key`, `.p12`, or private-key header was found.

### Secrets — git history

**Clean under a bounded pass; see provenance caveat.** No history-aware scanner is installed. The bounded manual pass over 8 high-signal patterns found 7 with zero matching commits and 1 (`sk-`) with a single commit `c534713`, which on inspection is the word `skipped` in a source comment. Recorded as **partial** in the provenance table: a pattern-based pass cannot rule out a high-entropy secret that matches none of the probed patterns.

**Context that changes the stakes:** the audit brief's premise was that this history is unpushed and therefore still recallable. It is not (F2). Commits up to `58a006e` are already on a public GitHub repository. Any secret in that range would already require rotation, not deletion. The bounded pass found none.

### Router-specific credential exposure

This is a router-admin extension built against real hardware, so captured live-device state was searched for specifically.

**No captured real device state found.** Specifically:

- **MAC addresses:** 10 occurrences, **all** the literal placeholder `AA:BB:CC:DD:EE:FF` used as `placeholder:` / `patternHint:` text. No real OUI, no vendor-assigned prefix, no hex outside `A`–`F` repeating pattern.
- **Private-range IPs:** 37 occurrences across 6 distinct addresses — `192.168.1.1` (27×, the documented ASUS factory default and the extension's `DEFAULT_SETTINGS.routerAddress`), `192.168.50.1` (3×, the other documented ASUS default, appearing only as example text in [GETTING_STARTED.md](docs/GETTING_STARTED.md)), and `192.168.1.10` / `192.168.1.5` / `192.168.1.0` / `10.0.0.0` (single occurrences, all as example or subnet-notation values in docs and field placeholders). Every one reads as a documented default or a textbook example. None is tied to a specific test claim in a way that would imply a captured live topology.
- **Session cookies / auth tokens:** `asus_token` appears only as a *string to detect* in a login-page regex, and in `docs/` prose analyzing the firmware's auth model. No token value.
- **Router login credentials:** `http_username` / `http_passwd` appear only as nvram key names in [admin.ts](src/pages/defs/admin.ts), inside a comment explaining that credential editing is **deliberately not modeled** — "not modeled here… also requires the page's separate md5-hashed change-password flow." The content script additionally hard-excludes `Main_Login.asp`, `Main_Password.asp`, and the QIS flows from mounting at all ([content.tsx:44-59](src/entrypoints/content.tsx:44)).

The live-capture document [docs/LIVE_PROBE_RT-BE92U.md](docs/LIVE_PROBE_RT-BE92U.md) opens with an explicit privacy note stating that the probe *did* render the operator's SSIDs, DHCP static-lease MACs and device names, a WireGuard peer key and public IP, and hundreds of live connections with real external IPs — and that **none of those raw values are reproduced**. Spot-checking the document confirms it: findings are recorded structurally (page renders, status codes, key *names*) with values withheld. The one exception is the `rc_support` flag string (line 101), which is a firmware feature-capability list — model-identifying, not household-identifying.

**Assessment: the privacy discipline claimed in `STATUS.md § Safety invariants` ("no live household data committed") holds up under inspection.**

### Env files

**None exist.** A working-tree search for `.env`, `.env.*`, and `*.env` returned zero files. There is therefore no leak-risk classification to make.

### Config completeness

**Not applicable — no environment-variable configuration surface exists.** The code reads no `process.env` / `import.meta.env` values for runtime configuration; all runtime config is a two-field object in `browser.storage.local` ([settings.ts](src/lib/settings.ts): `routerAddress`, `readOnlyMode`), both with in-code defaults, both surfaced in the popup UI, and both documented for end users in [docs/GETTING_STARTED.md](docs/GETTING_STARTED.md). There is no `.env.example` because there is nothing for one to declare. No gap.

### Licensing

- **Own license:** MIT, [LICENSE](LICENSE), © 2026 StarlightDaemon. Declared consistently in [package.json](package.json) (`"license": "MIT"`) and [README.md](README.md). The LICENSE carries a scope note excluding `RAW/` and the ASUS/Merlin names.
- **Non-affiliation disclaimer:** present in [README.md:23](README.md:23) and in the extension UI (About card, Extension Settings). Reconciled — matches what the code and manifest actually do; the manifest name is "Merlin's Cloak v2" and uses no ASUS branding.
- **Vendored third-party code:** `RAW/` contains four firmware trees, including two nested `.git` clones of Asuswrt-Merlin (GPL). **No `LICENSE` or `COPYING` file was found at depth ≤2 in any of them.** This is untracked and gitignored, so it is not distributed by this repository — but it is unlicensed-in-place third-party source sitting in the working directory, and the repo's own documentation ([docs/LICENSE_AUDIT.md](docs/LICENSE_AUDIT.md), 9.7 KB) exists precisely because GPL contamination of `src/` was a live concern. That audit is recorded as clean: one GPL line matched across 1,163 comment candidates (a row of hyphens), 14 short UI label phrases match native wording, and one base64 validation regex in `vpn-client.ts` is byte-identical to the firmware's. See F13.
- **Inherited assets:** the Fujin design token set in `src/theme/fujin-tokens.ts` is carried from the author's own v1 userscript and own `Fujin` repository, cited in [CHANGELOG.md](CHANGELOG.md). Same author — no third-party provenance question.

---

## 7. Extension Surface

### 7.1 Read-only interlock enforcement — **the central finding**

**Where the interlock is actually enforced:** [src/lib/write-guard.ts:93-97](src/lib/write-guard.ts:93). `guardedWrite()` checks module-scope `readOnly` and, when true, builds the request, logs it, and returns `{ dryRun: true, applied: false }` **without calling `submitBuiltWrite`**. This is real enforcement in code, not a UI affordance — the button label change in `SettingsPage.tsx` is cosmetic on top of it.

**Default state:** genuinely correct and defended on two independent layers, exactly as `STATUS.md` claims — `DEFAULT_SETTINGS.readOnlyMode = true` ([settings.ts:21](src/lib/settings.ts:21), merged *under* any stored partial so a malformed stored value cannot silently disable it, and returned by the `catch` path too) and `let readOnly = true` ([write-guard.ts:47](src/lib/write-guard.ts:47), the value in force before settings resolve). **Verified.**

**Where enforcement of the hard-excluded categories is absent:** nowhere in `src/` outside `types.ts` (the declaration) and `extension.tsx` (a display badge) does the string `writeExclusion` appear. The apply path — [SettingsPage.tsx:157-187](src/ui/SettingsPage.tsx:157) — consults `def.write`, `def.eulaGate`, validation errors, and dirty count. **It never consults `def.writeExclusion`.** Neither does `write-guard.ts`, which receives a `WriteSpec` that carries no category information at all: by the time a write reaches the only chokepoint, the category has been discarded.

**Consequence:** the interlock is a single global boolean. It is not a per-category control. Turning `readOnlyMode` off — one unconfirmed click in the popup — enables submission for **all 49 write paths simultaneously**, including all 28 defs tagged with the five categories the project states are hard-excluded pending verification. This is **F1, Critical**.

### 7.2 Manifest permissions completeness

Manifest source of truth is the `manifest:` factory in [wxt.config.ts:31-60](wxt.config.ts:31). Generated output verified in both `.output` targets.

| Declared | Used in code? | Assessment |
|---|---|---|
| `permissions: ["storage"]` | Yes — `browser.storage.local` (3×), `browser.storage.onChanged` (2×) in [settings.ts](src/lib/settings.ts) | **Justified** |
| `permissions: ["scripting"]` | Yes — `registerContentScripts`, `unregisterContentScripts`, `getRegisteredContentScripts` in [background.ts](src/entrypoints/background.ts); `executeScript` for the MAIN-world collector | **Justified** |
| `host_permissions` (6 origins: `192.168.1.1`, `router.asus.com`, `www.asusrouter.com` × http/https) | Yes — content-script `matches` in [content.tsx:22-29](src/entrypoints/content.tsx:22) are exactly these 6 | **Justified and appropriately narrow.** These are the documented ASUS factory defaults, not wildcards. Good practice. |
| `optional_host_permissions: ["http://*/*", "https://*/*"]` | Requested at runtime by the popup's `saveAddress()` for a user-entered host | **Overbroad — F3, High** |

**No unnecessary permissions were found.** `browser.tabs.create` is used but correctly *not* declared (it does not require the `tabs` permission). `browser.permissions.contains/request` require no declaration. There is no `webRequest`, no `cookies`, no `<all_urls>` in the required set. On the required-permission axis this extension is cleaner than most.

The problem is the optional set. `http://*/*` + `https://*/*` is functionally `<all_urls>`, deferred to runtime. The inline comment at [wxt.config.ts:43-45](wxt.config.ts:43) states the intent as *"a user-configured router address (any private origin)"* — but **nothing restricts it to a private origin**. The popup's `saveAddress()` accepts any non-empty host after stripping scheme and path, and requests `http://<host>/*` + `https://<host>/*` for it. No RFC1918 check, no loopback check, no `.local` check. A user (or anything that can drive that input) can grant this extension origin access to any site on the internet, and [background.ts:35-43](src/entrypoints/background.ts:35) will then register the full content script there — where [content.tsx](src/entrypoints/content.tsx)'s AsusWRT page-shape check is the only remaining barrier to mounting.

This is the single most common cause of browser-extension store-review friction, and the gap between the stated intent ("any private origin") and the implemented breadth ("any origin") is the finding.

### 7.3 Content Security Policy

**No `content_security_policy` key is declared** in `wxt.config.ts` or in either generated manifest. **The MV3 platform default is therefore in effect**, which is `script-src 'self'; object-src 'self'` — already strict, disallowing `unsafe-inline` and `unsafe-eval` in extension pages by construction.

**Explicitly: absence of a CSP declaration here is not a deficiency.** No `unsafe-inline`, no `unsafe-eval`, and no permissive `connect-src`/`script-src` exists to flag, because no policy overrides the strict default. The codebase corroborates the posture: `router-io.ts` documents "never eval," and no `eval`/`new Function` construct appears in `src/`.

One nuance worth recording (not a CSP finding, but adjacent): the fallback flag collector at [capabilities.ts:117-138](src/lib/capabilities.ts:117) injects a `<script>` with inline `textContent` into the *page*. Extension CSP does not govern that — the page's own CSP does — and the code comments record that this injection is silently dropped on the target firmware, which is why the `scripting.executeScript` path exists. It remains as dead-in-practice fallback code carrying its own weakness (F8).

### 7.4 Web-accessible resources

**No `web_accessible_resources` key is declared**, and none appears in either generated manifest. There is nothing exposed to arbitrary origins and therefore nothing over-exposed. **No finding.** This is the correct posture for an extension whose only injected assets are bundled into the content script itself.

### 7.5 Cross-context message passing

Complete inventory of handlers across both contexts:

| Handler | File | Sender validation | Assessment |
|---|---|---|---|
| `browser.runtime.onMessage` | [background.ts:78-94](src/entrypoints/background.ts:78) | **None.** Filters on `msg.type === 'mc2-collect-flags'` and reads `sender.tab?.id`, but never checks `sender.id` or `sender.origin`. | **F7, Medium** |
| `window.addEventListener('message')` | [capabilities.ts:105-115](src/lib/capabilities.ts:105) | **Nonce only.** No `ev.source === window` check, no `ev.origin` check. Nonce is `Math.random()`-derived and embedded in a script injected into the page's own MAIN world. | **F8, Medium** |
| `chrome.runtime.onMessageExternal` | — | **Not present anywhere.** | Good |
| `externally_connectable` | — | **Not declared.** | Good — this is what caps F7 |

**Why F7 is Medium rather than High:** with no `externally_connectable` declared, `runtime.onMessage` is reachable only from the extension's own contexts — its popup and its own content scripts. An arbitrary web page the user visits **cannot** talk to this handler. The classic "any page can reach the privileged context" attack does not apply here. The residual exposure is real but narrower: the handler will run `scripting.executeScript({ world: 'MAIN' })` in the sender's tab on request, and the set of tabs where a content script exists is user-widenable via the overbroad optional host permission (F3). It performs no router write, reads no credential, and writes no setting — which is why it is not High. It is nonetheless the one privileged-capability handler in the extension with no authorization check, on a project whose entire safety story is chokepoints.

**Why F8 matters:** the nonce is not a secret from the party that matters. It is embedded verbatim in `script.textContent` of an element appended to `document.head` in the page's own world. Page-resident JavaScript — on this firmware, thousands of lines of vendor JS the extension deliberately keeps running underneath — can read it via a `MutationObserver` or `document.currentScript` before `script.remove()` takes effect. With the nonce, page script (or a cross-origin iframe, since `ev.source` is unchecked) can post a forged flags payload. Impact is capability spoofing: `caps.flags` drives which views render and which fields are gated by `showIf`. Forged flags could surface views the router does not support. It cannot bypass the read-only interlock. Additionally, both replies are posted with target origin `'*'`, broadcasting the collected support-flag set to any listener in the frame tree.

### 7.6 Manifest version and background context

**Both targets are Manifest V3. No MV2 patterns are present.**

| | Chrome | Firefox |
|---|---|---|
| `manifest_version` | `3` | `3` |
| Background | `{"service_worker": "background.js"}` | `{"scripts": ["background.js"]}` |
| Persistent background page | **absent** | **absent** |

Firefox's `background.scripts` under MV3 is a **non-persistent event page**, which is the correct and required Firefox MV3 form — Firefox does not implement `background.service_worker`. This is WXT emitting the right thing per target, **not** an MV2 leftover. There is no `"persistent": true`, no `browser_action`, no `page_action`, and no blocking `webRequest` anywhere. **No finding.**

### 7.7 Cross-browser build target consistency

Both targets build and both outputs are present and current in `.output/` (`chrome-mv3/`, `firefox-mv3/`). Scripts exist for both in [package.json](package.json) (`build`/`build:firefox`, `zip`/`zip:firefox`, `dev`/`dev:firefox`), with `--mv3` passed explicitly on every Firefox invocation.

Divergences between the two generated manifests, each checked:

| Divergence | Handled deliberately? |
|---|---|
| `version` — Chrome `0.9.0` + `version_name: 0.9.0-beta.1`; Firefox `0.9.0-beta.1` | **Yes** — explicit conditional in [wxt.config.ts:34-40](wxt.config.ts:34) with a comment explaining that Firefox has no `version_name` field. *(Caveat: this handling is **uncommitted** — F10.)* |
| `browser_specific_settings.gecko` — Firefox only | **Yes** — explicit `env.browser === 'firefox'` branch, carrying a stable extension id and a `data_collection_permissions: { required: ['none'] }` declaration (required by recent AMO policy). |
| Background shape — service worker vs scripts | **Yes** — WXT-generated per target; correct for both. |

**No unhandled drift found.** Permissions, host permissions, optional host permissions, content-script matches, icons, and action/popup are byte-identical across the two manifests.

**The gap is verification, not build parity:** the Firefox build has never been loaded against a live router. This is a known, separately-tracked open gap (`STATUS.md` items 1 and § line 91, `README.md`, `CHANGELOG.md` — declared in three places) and was not attempted here. Recorded as F15, Low, purely for completeness — the project already tracks it accurately.

One minor documentation drift: `STATUS.md` line 185 refers to `.output/firefox-mv2 or -mv3`; only `firefox-mv3` exists and all scripts force `--mv3`. Folded into F15.

---

## 8. Dependencies & Tooling

**Package manager:** npm, confirmed — [package-lock.json](package-lock.json) present (334 KB), no `yarn.lock`, no `pnpm-lock.yaml`, no `bun.lockb`. Lockfile is committed and tracked. **Lockfile health: good** — `npm audit --package-lock-only` parsed it without error, and it is in sync with `package.json` (only 3 devDependency version lines differ in the uncommitted working-tree diff).

**Advisory summary (`npm audit --package-lock-only`): 18 total — 3 critical, 12 high, 2 moderate, 1 low.**

Detail read for Critical and High only, per the output cap:

| Severity | Package | Range | Direct? | Advisory |
|---|---|---|---|---|
| **Critical** | `shell-quote` | `<=1.8.4` | no | `quote()` does not escape newlines in object `.op` values; plus quadratic-complexity DoS in `parse()` (CWE-407) |
| **Critical** | `fx-runner` | `1.0.5 – 1.4.0` | no | via `shell-quote` |
| **Critical** | `web-ext-run` | `*` | no | via `firefox-profile`, `fx-runner`, `multimatch`, `node-notifier`, `tmp` |
| High | `wxt` | `>=0.4.0` | **yes** | via `web-ext-run` |
| High | `@wxt-dev/module-react` | `*` | **yes** | via `wxt` |
| High | `eslint` | `4.1.0 – 10.0.0-rc.2` | **yes** | via `@eslint/config-array`, `@eslint/eslintrc`, `minimatch` |
| High | `eslint-plugin-react` | `>=7.23.0` | **yes** | via `minimatch` |
| High | `minimatch` | `2.0.0 – 10.0.2` | no | via `brace-expansion` |
| High | `brace-expansion` | `<=5.0.7` | no | DoS via unbounded expansion length → OOM crash |
| High | `adm-zip` | `<0.6.0` | no | crafted ZIP triggers 4 GB allocation |
| High | `tmp` | `<0.2.6` | no | path traversal via unsanitized prefix/postfix enabling directory escape |
| High | `firefox-profile`, `multimatch`, `@eslint/config-array`, `@eslint/eslintrc` | various | no | transitive |

**The load-bearing nuance: every one of the 18 advisories is in the devDependency graph.** The shipped runtime dependencies are exactly two — `react@^19.2.4` and `react-dom@^19.2.4` — and **neither appears in the audit output at any severity**. Nothing vulnerable is bundled into the extension artifact that reaches a user's browser. The entire tree traces to two roots: `wxt → web-ext-run` (the Firefox dev-runner chain: `shell-quote`, `fx-runner`, `adm-zip`, `tmp`, `firefox-profile`, `node-notifier`, `uuid`) and `eslint → minimatch → brace-expansion`. The exposure is to the developer's machine during `wxt dev`/`build`, not to end users.

The two direct devDependency roots (`wxt`, `eslint`) are both flagged only *because of* their transitives, and both are on current major versions — `wxt@0.20.27` is the latest 0.20.x line, and the advisory ranges (`wxt >=0.4.0`, `eslint 4.1.0 – 10.0.0-rc.2`) span essentially every shipping version, meaning no in-line upgrade resolves them today.

**Outdated (`npm outdated`):** 3 direct devDependencies, all one major behind, none with a `Wanted` upgrade available (i.e. all satisfied within their declared ranges):

| Package | Current | Wanted | Latest |
|---|---|---|---|
| `eslint` | 9.39.5 | 9.39.5 | **10.8.0** |
| `@eslint/js` | 9.39.5 | 9.39.5 | **10.0.1** |
| `typescript` | 5.9.3 | 5.9.3 | **7.0.2** |

Runtime deps (`react`, `react-dom`) and the WXT toolchain are current.

**Deprecations:** no deprecated GitHub Actions to flag (no workflows exist). No deprecated WXT or manifest APIs in use — the codebase uses `wxt/browser`'s unified `browser.*` namespace throughout, `defineBackground`/`defineContentScript`/`defineConfig` per current WXT convention, and MV3 APIs exclusively.

**Node:** pinned to `22` via [.nvmrc](.nvmrc). Node 22 is a current LTS line — **not EOL**.

---

## 9. Oddities

- **The audit's own gating premise was false.** This review was framed as the pre-push gate on a never-pushed history. The history was already pushed, to a public repository, before the review began (F2).
- **A 4.5 GB working directory backing an 82-file repository.** `RAW/` is 99.5% of the working tree by file count and contains two nested `.git` clones. The project is, by disk, a firmware-research workspace with an extension in one corner of it.
- **Zero inline debt markers across 12.5k lines.** One `TODO|FIXME|HACK|XXX|BUG` hit repo-wide, and it is a false positive (`generateXXX()` in prose). Either exceptional discipline or — supported by the 7-item prose list in `STATUS.md` — a deliberate convention of tracking loops in documents rather than in code (F17).
- **`git shortlog -sn` returned no output** despite 53 commits with author metadata present. Not investigated further; recorded as an environment oddity.
- **Build outputs are ahead of `HEAD`.** Both `.output/` targets were built from the uncommitted working tree; `firefox-mv3/manifest.json` carries a version string that does not exist in any commit (F10).
- **`.claude/settings.local.json` is ignored by the user's global excludes file, not by this repo's `.gitignore`.** It contains a permission allowlist including `Bash(git push *)`. It is not tracked and not at risk of commit on this machine — but the repo carries no local rule that would prevent it being committed on a machine without that global config.
- **`.serena/project.yml` is tracked and already published publicly.** Inspected: it is a stock Serena project config with no secrets, no absolute paths, and empty `ignored_paths`. Info only (F19).
- **A retained dead code path that is also the weaker of two implementations.** The inline-`<script>` flag collector ([capabilities.ts:94-142](src/lib/capabilities.ts:94)) is documented as silently dropped on the only firmware ever tested, is superseded by the `scripting.executeScript` path, and carries F8's message-validation weakness — while being, in practice, unreachable on the target hardware.
- **`start_apply` endpoint support is fully implemented and used by zero page definitions** — explicitly noted in `STATUS.md` ("start_apply support remains in lib/router-io.ts but no def uses it"). Deliberate, documented, and dead.
- **No `.gitattributes` on a Windows checkout.** Every `git diff` on a modified file emits CRLF conversion warnings.

---

## 10. Findings Index

Volatile findings are marked **[V]** — git state is point-in-time and must be re-verified before acting.

| ID | Severity | Effort | Blast Radius | Location | Finding | Cross-ref |
|---|---|---|---|---|---|---|
| **F1** | **Critical** | Bounded | Cross-cutting | [src/ui/SettingsPage.tsx:157](src/ui/SettingsPage.tsx:157), [src/lib/write-guard.ts](src/lib/write-guard.ts), [src/pages/types.ts:169](src/pages/types.ts:169) | `writeExclusion` is diagnostic metadata, never enforced — all 28 defs in the five hard-excluded categories are write-capable whenever the global interlock is off | STATUS §Known open items 2, 3; STATUS §Findings-from-live-pass 3 |
| ↳ F1a | Critical | Trivial | Localized | [SettingsPage.tsx:157-187](src/ui/SettingsPage.tsx:157) | The apply path checks `def.write`, `def.eulaGate`, validation, and dirty count — never `def.writeExclusion` | — |
| ↳ F1b | Critical | — | Cross-cutting | `src/pages/defs/` | 28 defs tagged `wireless`(6), `wan`(2), `dhcp`(1), `vpn`(8), `firewall`(11) each carry a live `write:` block reachable via Apply | — |
| ↳ F1c | High | Trivial | Localized | [docs/GETTING_STARTED.md:266-280](docs/GETTING_STARTED.md:266) | End-user compatibility matrix advertises 49 "views that can change settings," including Wireless 7, Internet Connection 4, Security 12, VPN 8 — the excluded categories, presented to users as functional | — |
| **F2** | **High** **[V]** | Trivial | Cross-cutting | [STATUS.md:49](STATUS.md:49), [STATUS.md:91](STATUS.md:91) | STATUS.md asserts twice that nothing has been pushed; `origin/main` (`58a006e`) is an ancestor of local `main` and the GitHub repo is **PUBLIC** (created 2026-07-24, pushed 2026-07-25T00:04:53Z, 30 files published). The premise gating this review is false | — |
| **F3** | **High** | Bounded | Cross-cutting | [wxt.config.ts:45](wxt.config.ts:45), [src/entrypoints/popup/App.tsx](src/entrypoints/popup/App.tsx) `saveAddress`, [background.ts:29-43](src/entrypoints/background.ts:29) | `optional_host_permissions: ["http://*/*","https://*/*"]` is functionally `<all_urls>`; the inline comment claims "any private origin" but `saveAddress()` applies no RFC1918/loopback/`.local` restriction to the host it requests | — |
| **F4** | **High** | Sprawling | Localized | [package-lock.json](package-lock.json) | 18 advisories (3 critical / 12 high / 2 moderate / 1 low), all in the devDependency graph via `wxt → web-ext-run` and `eslint → minimatch`. Runtime deps (`react`, `react-dom`) are clean; nothing vulnerable ships to users. Advisory ranges span all current versions of both direct roots | — |
| **F5** | Medium | Sprawling | Cross-cutting | repo-wide | **No test suite exists** — 0 test files, 0 test config, no `test` script, no coverage tooling, against ~12.5k lines. Reverse-engineered codecs (`rulelist.ts`, parental schedule tokens, IPSec sharded lists, traffic hex parser, write-payload builder) carry zero assertions. Test confidence: **none** | — |
| **F6** | Medium | Bounded | Cross-cutting | `.github/` (absent) | No CI definitions exist. The only remote run in history is a GitHub-managed Dependabot job. Typecheck, lint, and build cleanliness are asserted in STATUS.md and have never been machine-verified | — |
| **F7** | Medium | Trivial | Localized | [src/entrypoints/background.ts:78](src/entrypoints/background.ts:78) | `runtime.onMessage` handler performs no `sender.id` / `sender.origin` validation before invoking `scripting.executeScript({world:'MAIN'})` in the sender's tab. Capped below High because `externally_connectable` is undeclared, so arbitrary pages cannot reach it | F3 widens the reachable tab set |
| **F8** | Medium | Bounded | Localized | [src/lib/capabilities.ts:105](src/lib/capabilities.ts:105) | `window.message` listener validates only a nonce that page script can read from the injected `<script>`'s own text; no `ev.source` / `ev.origin` check. Enables capability-flag spoofing by page or iframe script. Replies are posted with target origin `'*'` | Path is dead-in-practice on tested firmware |
| **F9** | Medium | Trivial | Localized | [src/entrypoints/popup/App.tsx](src/entrypoints/popup/App.tsx) `toggleReadOnly` | The read-only interlock — the sole barrier described in F1 — is disabled by one unconfirmed click, with no confirmation dialog, no warning copy, and no re-arm | F1 |
| **F10** | Medium **[V]** | Trivial | Localized | [wxt.config.ts](wxt.config.ts), `.output/firefox-mv3/manifest.json` | Uncommitted `wxt.config.ts` change alters the shipped **Firefox manifest `version`**; both `.output/` builds were produced from the dirty tree, so the built artifacts carry a version string present in no commit | — |
| **F11** | Low | Bounded | Localized | [src/lib/write-guard.ts:47](src/lib/write-guard.ts:47), [src/ui/App.tsx:75-85](src/ui/App.tsx:75) | Interlock state is module-scope mutable, synchronized into the content-script context by a React `useEffect` rather than read by the guard itself. Currently fails closed and is correct; the safety property depends on UI-layer wiring with no test behind it | F5 |
| **F12** | Low | Trivial | Cross-cutting | [background.ts:20](src/entrypoints/background.ts:20), [content.tsx:33](src/entrypoints/content.tsx:33), popup `saveAddress` | Scheme/path-stripping host extraction is duplicated verbatim in three places on a security-relevant path, with no shared helper | F3 |
| **F13** | Low | Bounded | Localized | `RAW/` | 4.5 GB / ~16,300 untracked gitignored files; two nested `.git` clones of GPL firmware; **no `LICENSE`/`COPYING` found at depth ≤2** in any of the four trees. Not distributed by this repo, but unlicensed-in-place third-party source in the working directory | [docs/LICENSE_AUDIT.md](docs/LICENSE_AUDIT.md) records the `src/` contamination check as clean |
| **F14** | Low | Bounded | Localized | [package.json](package.json) | 3 direct devDependencies one major behind with no in-range upgrade: `eslint` 9.39.5→10.8.0, `@eslint/js` 9.39.5→10.0.1, `typescript` 5.9.3→7.0.2 | F4 |
| **F15** | Low | Bounded | Localized | [package.json](package.json), [STATUS.md:185](STATUS.md:185) | Firefox build has never been loaded against live hardware (declared accurately in three places; not attempted here per scope). Minor drift: STATUS.md references `.output/firefox-mv2 or -mv3`; only `firefox-mv3` exists and all scripts force `--mv3` | STATUS §Known open items 1 |
| **F16** | Info | Trivial | Localized | `.audits/` | `.audits/` is a **Tool directory** created by this audit and is not covered by [.gitignore](.gitignore). Recommend the operator gitignore it. This audit did not edit `.gitignore` | — |
| **F17** | Info | — | Cross-cutting | repo-wide | Open loops are tracked exclusively as prose in [STATUS.md](STATUS.md) (7 numbered items) with no code anchors; a repo-wide debt-marker grep returns one false positive. Loops are invisible to tooling and to anyone reading the code alone | §4 |
| **F18** | Info | — | — | working tree + history | **Secrets: clean.** No credential value in the working tree; bounded 8-pattern history pass found nothing (sole `sk-` hit in `c534713` is the word `skipped`). No `.env` files exist. No captured live device state — MACs are all `AA:BB:CC:DD:EE:FF`, private IPs are all documented defaults or examples, `asus_token` appears only in a detection regex. **Recorded as partial**: no history-aware scanner is installed | Provenance table |
| **F19** | Info | — | Localized | `.serena/project.yml`, `.claude/settings.local.json` | `.serena/project.yml` is tracked and already publicly published — inspected, contains no secrets or absolute paths. `.claude/settings.local.json` (contains a `Bash(git push *)` allowlist entry) is untracked only by virtue of the **user's global** excludes file; no repo-local rule protects it on another machine | F2 |

---

*End of report. This audit surfaces findings only — it does not prioritize, sequence, or prescribe remediation.*
