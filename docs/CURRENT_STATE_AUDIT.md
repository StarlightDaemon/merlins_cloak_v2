# Current State Audit — 2026-07-25

Fresh-verification pass, independent of STATUS.md's own claims. Each section
states what was actually re-checked and how, not what was previously asserted.

## HEADLINE — read this before running the next-session taxonomy proposal

**PENDING — see final update at the end of this section once Tasks 2–4 complete.**
Preliminary check (below, Task 1) re-derived the view/category counts directly
from `src/pages/defs/*` source rather than trusting STATUS.md's summary table,
and they matched exactly: **73 views (50 settings + 23 custom), 67 distinct
native .asp pages, 14 Merlin-only views, 18 nav categories**. No discrepancy
found yet that would change the taxonomy proposal's premise. This line will be
updated (or left as final) after the full per-view inventory and the Firefox
check are done.

---

## Task 1 — Git and build state (2026-07-25, fresh)

### Git

- `git log --oneline`: HEAD is `dd1dc13` "STATUS: record Chrome
  live-verification results and findings" — matches what STATUS.md's own
  changelog implies (it describes itself as the record of the session ending
  at that commit).
- `git status`: **working tree clean**, nothing staged or unstaged.
- Branch is **ahead of `origin/main` by 11 commits** (i.e. nothing has been
  pushed yet this project). Not a discrepancy against STATUS.md — STATUS.md
  never claims anything about push state — but worth flagging since it means
  all work so far is local-only.
- No discrepancy found between committed state and STATUS.md's claims about
  what commit the document reflects.

### Build (both re-run fresh this session, `.output/` deleted first)

| Check | Command | Result |
|---|---|---|
| Lint | `npm run lint` | **PASS** — clean, no output |
| Typecheck | `npm run compile` (`tsc --noEmit`) | **PASS** — clean, no output |
| Chrome build | `npm run build` (`wxt build`, chrome-mv3) | **PASS** — built in 498ms, 632.42 kB total, all expected artifacts present (manifest.json, background.js, content-scripts/content.js, popup bundle, icons) |
| Firefox build | `npm run build:firefox` (`wxt build -b firefox --mv3`) | **PASS** — built in 510ms, 632.55 kB total, same artifact set under `firefox-mv3` |

STATUS.md's claim "Lint clean; Chrome (MV3) and Firefox builds both pass" is
**confirmed accurate** as of this session — not stale. Note the Firefox
target actually built is `firefox-mv3` (via `-b firefox --mv3`), not MV2;
STATUS.md's open-items list says "`.output/firefox-mv2 or -mv3`" — the
project only has an MV3 Firefox build script (`build:firefox`), no MV2 script
exists in package.json. This is a documentation-precision nit, not a
functional discrepancy: only one Firefox target exists and it builds.

### Summary

No gap between what's committed and what STATUS.md describes. No build
regressions. The single-source-of-truth risk here is unrelated to Task 1:
the *live-verification* claims (Chrome done, Firefox not run) are a separate
question addressed in Task 3 below, and are about operator-observed runtime
behavior, which a build pass cannot substitute for.

---

## Task 2 — Page-by-page inventory, read from actual source

Read directly from `src/pages/defs/*.ts(x)` and `src/pages/types.ts` — not
from STATUS.md's category summary table. One category at a time, in
`NAV_GROUPS` order (`src/pages/registry.ts`), committed after each. Columns:

- **Read** — nvram keys / hooks it reads.
- **Write** — `settings` pages either have a `write:` block (endpoint +
  rcService) or are tagged `writeExclusion` (write path exists in code but is
  a **hard-excluded category** — never live-submitted this project); `custom`
  pages either have no write path (pure display) or perform a specific
  user-triggered action (documented per-row).
- **Confidence** — the page's declared `confidence.read` / `.write` tier:
  `live-verified` (checked against the operator's RT-BE92U),
  `structural` (firmware-source-derived, not yet exercised live), or
  `unverified-write` (write path coded, never submitted).

### Status (`navGroup: 'status'`) — 2 views

| id | title | aspPage | Description | Reads | Write | Confidence |
|---|---|---|---|---|---|---|
| `dashboard` | Network Map | index.asp | Landing page: WAN state/IP/gateway/DNS/proto, LAN IP, firmware identity, uptime, and per-band (2.4/5/6 GHz) radio SSID+on/off. On SDN-managed units (`mtlancfg_support`), resolves the real broadcast SSID from `sdn_rl`'s MAINFH record's `apg{idx}_ssid` instead of the placeholder `wl{N}_ssid`. | nvram: `wan0_state_t`, `wan0_ipaddr`, `wan0_gateway`, `wan0_dns`, `wan0_proto`, `lan_ipaddr`, `wl0/1/2_radio`, `wl0/1/2_ssid` (ascii), conditionally `sdn_rl`/`apg{idx}_ssid`; hook: `uptime()` | none — read-only display | read: live-verified |
| `clients` | Clients | update_clients.asp | Merges DHCP leases with live wireless-station presence (`get_wclientlist()`) into one table; unnamed-hostname/`*` leases normalized to blank; auto-refreshes every 15s. | DHCP leases (via `fetchDhcpLeases`, dnsmasq lease file); hook: `get_wclientlist()` | none — read-only display | read: live-verified |

**Committed as part of this entry.**
