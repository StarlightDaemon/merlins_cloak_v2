# GPL Verbatim-Content Audit

Audit of this repository's own source (`src/`) against the GPL source trees
preserved under `RAW/`, run before adding a LICENSE file, to establish whether
any part of this client is a copy of ASUS or Asuswrt-Merlin code rather than an
independent reimplementation.

Audited at commit `650fcb1`. Scope: all 50 `.ts`/`.tsx` files under `src/`
(~12,500 lines). Non-source assets (icons, WXT template SVGs) were not in scope;
no vendored third-party JavaScript exists in this repository.

---

## 1. Reference trees

All four GPL trees from the earlier structural-diff sessions are still present
and were used:

| Tree | Path | Files in `www/` |
|---|---|---|
| Merlin, RT-BE92U branch (3006) | `RAW/merlin/release/src/router/www` | 2,704 (241 top-level `.asp`) |
| Stock, RT-BE92U | `RAW/stock/extracted/asuswrt/release/src/router/www` | 4,318 |
| Merlin, RT-AX88U branch (3004) | `RAW/merlin-ax88u/release/src/router/www` | present |
| Stock, RT-AX88U | `RAW/stock-ax88u/.../www` | present |

---

## 2. Method

Four mechanical passes, each fixed-string (not fuzzy), run in both the
src→GPL direction and — where meaningful — the reverse:

1. **Comment blocks.** Every comment line in `src/` of 32 characters or more
   (1,163 distinct lines) matched as a literal string against all four `www/`
   trees. A copied GPL comment would surface as a src line present verbatim in
   the GPL tree.
2. **String literals.** Every string/template literal in `src/` of 10
   characters or more (~1,840 distinct) matched against the same trees, then
   reviewed by descending length.
3. **String tables.** Every `label:` / `hint:` / `title:` / `name:` /
   `help:` / `description:` value in `src/` (961 distinct strings) matched
   against the same trees, to detect a lifted option or label table rather
   than incidental single-string overlap.
4. **Identifiers and structure.** All declared function/const/component names
   in `src/` (468) matched against the Merlin tree, plus manual reading of the
   I/O and parsing layers (`router-io.ts`, `trafmon.ts`, `netool.ts`,
   `status-feeds.ts`, `capabilities.ts`) against the native equivalents
   (`httpApi.js`, the traffic-monitor pages, `state.js`).

---

## 3. Results

### 3.1 Comment blocks — clean

Of 1,163 comment lines tested, exactly **one** matched anything in any GPL
tree, and it was a run of hyphens used as a section rule. No prose comment,
explanatory block, or header comment in `src/` exists in the GPL source.

The comments in `src/` are consistently *about* the native pages — they name
the `.asp` file being modeled, describe the nvram/endpoint behavior observed,
and record what was deliberately not modeled. That is the signature of notes
written while reimplementing, not of copied source.

A small number of comments quote a line or two of native JavaScript inline as
a citation, e.g. `src/pages/defs/qos.ts:23` quotes
`document.form.qos_obw.value = document.form.obw.value*1024` to document the
unit conversion the native page performs. These are marked as quotations,
appear only inside comments, and are not executed. Retained as accurate
documentation of the behavior being matched.

### 3.2 Identifiers, endpoints, and functional values — expected overlap

The following classes of string match the GPL trees and are expected to,
because they *are* the interface being spoken to. Changing any of them would
break the client:

- nvram key names (`ipsec_dead_peer_detection`, `vpnc_pptp_options_x_list`,
  `reboot_schedule_enable`, …)
- native page filenames used as provenance/`prior-names` data
  (`Advanced_Wireless_Content.asp`, `Main_TrafficMonitor_daily.asp`, …)
- CGI endpoints and service-restart directives (`applyapp.cgi`,
  `start_apply.htm`, `restart_wrs;restart_firewall`, …)
- literal nvram *values* that must be sent byte-exact — DDNS provider tokens
  (`WWW.TUNNELBROKER.NET`, `FREEDNS.AFRAID.ORG`, `DOMAINS.GOOGLE.COM`, …) and
  OpenSSL cipher identifiers (`AES-256-CBC`, `CAMELLIA-192-CBC`, …)

None of this is expressive content.

### 3.3 String tables — not copied

No option table in `src/` is a lifted copy. The two cases worth recording:

- **Time zones** (`src/pages/defs/admin.ts:401`). The nvram *codes* are taken
  from the native `timezones[]` array — they are the literal values the
  firmware accepts. The English *labels* are original: the GPL source carries
  only locale placeholders (`<#TZxx#>`) with no language pack in the tree, so
  there was no label text to copy. The table is also a curated 24-entry subset
  of the native ~90, with documented fallthrough for unlisted values. The file
  states all of this in its own comment.
- **Cipher / mode lists** (`vpn-server.ts`, `wireless.ts`). Value and label are
  the same string in each entry, and that string is a protocol identifier.

### 3.4 UI label text — 14 short phrases match verbatim (see §4)

Of 961 label-class strings, 336 appear somewhere in the GPL trees, but nearly
all of those are substring hits on generic words, standard networking
terminology ("Beacon Interval", "Fragmentation Threshold",
"Protected Management Frames", "WPA2/WPA3-Personal"), product names used
nominatively ("Guest Network Pro", "WireGuard Server", "GeForce NOW QoS"), or
the functional values in §3.2.

Filtering to distinctive ASUS/Merlin-authored phrasing leaves **14** strings
that match the native UI's label text word for word:

| String | src location |
|---|---|
| `Advertise router's IP in addition to user-specified DNS` | `lan.ts:136` |
| `Redirect webui access to www.asusrouter.com` | `tools-tweaks.ts:106` |
| `Redirect Internet traffic through tunnel` | `vpn-client.ts:276` |
| `Rebuild entire database at start` | `usb.ts:317` |
| `Intercept NTP client requests` | `admin.ts:461` |
| `Filtered ICMP packet types` | `firewall.ts:410` |
| `Force as Master Browser` | `usb.ts:132` |
| `Connect to APs in list` | `wireless.ts:325` |
| `Exported filesystems` | `usb.ts:438` |
| `DHCP query frequency` | `wan.ts:165` |
| `Create NAT on tunnel` | `vpn-client.ts:238` |
| `Simpler share naming` | `usb.ts:127` |
| `Save history location` | `traffic.tsx:319` |
| `Between 0 and 6. Default: 3` (hint) | `vpn-server.ts:389` |

### 3.5 Logic structure — independently written

No shared function names beyond incidental substring collisions. The I/O layer
is structurally unlike the native `httpApi.js`: it has no cache object, no
`httpApi.*` namespace, no `.ajax` wrapper, different batching (chunked hook
concatenation), and a verification model — poll forced-fresh nvram until the
expected value appears — that the native UI does not implement at all.

The parsers necessarily mirror the *wire formats* they consume
(`update.cgi`'s JS-literal output with hex counters, `<`/`>`-delimited nvram
rule lists). Format-following is dictated by the data, and the
implementations are structurally different from the native ones (e.g.
`trafmon.ts` normalizes the JS literal to strict JSON and `JSON.parse`s it,
where the native page executes the same response as script via jQuery's
`dataType: 'script'` — `Main_TrafficMonitor_realtime.asp:127`).

One byte-identical functional token was found:
`BASE64_PATTERN` at `src/pages/defs/vpn-client.ts:30` is the same 64-character
base64 validation regex used in `Advanced_WireguardClient_Content.asp`. It is
also the canonical, widely-published base64 regex, so common origin is at
least as likely as copying. Noted for completeness.

---

## 4. Assessment

**No copied code was found. The audit is clean for licensing purposes.**

Nothing in `src/` is a translation, transliteration, or restructuring of GPL
source. The comment pass — the most sensitive test for copying, since comments
carry no functional constraint — came back empty across 1,163 lines. The
architecture, naming, and control flow are the author's own.

The 14 label strings in §3.4 are recorded here because the instruction was to
report anything that reads as copied, and these are literally the same words
as the native UI. They are **not** treated as blocking, for three reasons:

1. They are short functional phrases naming a setting — the kind of thing
   copyright's short-phrase doctrine does not protect, and which carries no
   authorial expression beyond "this is the DNS advertisement checkbox."
2. Reusing them is the point. This client's job is to let an operator find the
   control they already know from the router's own UI; renaming
   "Intercept NTP client requests" to something else would make the mapping
   *less* honest, not more.
3. They are label text, not code. They do not make this repository a
   derivative work of the GPL firmware, and adding an MIT LICENSE to this
   repository does not purport to relicense them — an MIT grant covers the
   work its owner authored, and §5 records that limit explicitly.

If the operator prefers to eliminate even this overlap, rephrasing those 14
strings is a self-contained change with no functional effect. That is a
preference call, not a compliance requirement.

## 5. Scope of the license grant

The MIT license added alongside this audit covers the contents of this
repository — the extension source under `src/`, its configuration, and its
documentation. It does not extend to:

- The `RAW/` reference trees, which are ASUS and Asuswrt-Merlin GPL source
  retained locally for analysis and excluded from distribution.
- ASUS and Asuswrt-Merlin product names, feature names, and the label wording
  in §3.4, which are used descriptively to identify the settings this client
  reads, and which remain their owners' property.

## 6. Conclusion

Task 1 result: **clean**. No finding blocks proceeding to add a LICENSE.
