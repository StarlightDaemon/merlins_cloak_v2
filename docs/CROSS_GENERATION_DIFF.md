# Cross-Generation Web UI Comparison — RT-AX88U (ASUSWRT 4.0) vs RT-BE92U (ASUSWRT 5.0)

Static source comparison only. **No live router was contacted at any point.** The
operator does not own an RT-AX88U; every statement here is derived from published
source archives and the Asuswrt-Merlin git repository, and nothing has been
behaviourally verified.

This report extends [`STOCK_VS_MERLIN_DIFF.md`](STOCK_VS_MERLIN_DIFF.md) (RT-BE92U),
which is committed at `12777f5` and was read as the baseline for §4–§6 below.

---

## 1. Summary

### Sources compared

| | RT-AX88U (this session) | RT-BE92U (prior session) |
|---|---|---|
| Platform | ASUSWRT **4.0** (`3.0.0.4.388`), Wi-Fi 6, BCM4908 / `src-rt-5.02axhnd` | ASUSWRT **5.0** (`3.0.0.6.102`), Wi-Fi 7 |
| Stock artifact | `GPL_RT_AX88U_300438824209.zip` → `GPL_RT-AX88U_3.0.0.4.388.24209-g4f420d0.tgz` | `GPL_RT_BE92U_300610238962.zip` |
| Stock version | `3.0.0.4.388_24209` (2024-09-25) | `3.0.0.6.102_38962` (2025-09-10) |
| Merlin ref | tag **`3004.388.11`**, commit `280221387bccd9c8d1f54401eb33868c0f68fb65`, 2025-12-26 | tag `3006.102.7_2`, commit `542f7111…`, 2026-03-24 |
| Merlin's GPL base | **388_25575** (`Changelog-NG.txt`: "Merged GPL 388_25575") | 102_39848 |
| Newest stock *firmware image* Asus offers | `3.0.0.4.388_24385` (2026-04-17) | 102_39063 (2026-05-07) |

**The RT-AX88U Merlin ref used here is `3004.388.11` — the latest stable tag on the
branch that supports this model. It is *current stable*, not a specific deployment.**
There is no deployed RT-AX88U to match: `3004.388.12-beta1` exists but is a beta and
was deliberately not used. RT-AX88U is a first-class target on this branch (1,892
model-specific paths, including a dedicated `release/src-rt-5.02axhnd/router-sysdep.rt-ax88u/`
tree).

### Version gap — wider than on the RT-BE92U

**Merlin's RT-AX88U base is GPL 388_25575. The newest GPL Asus publishes is 388_24209.**
Per `Changelog-NG.txt`, Merlin merged **four** Asus GPL drops after the published one:
`388_24353` → `388_25373` → `388_25523` → `388_25575`. On the RT-BE92U the equivalent
gap was a *single* drop (38962 → 39848).

Asus's newest published RT-AX88U *firmware image* is `388_24385`, which is also older
than Merlin's stated base. So, exactly as on the RT-BE92U, Merlin is building from an
Asus drop that Asus has released neither as source nor as a binary on the support site.

**Consequence:** the attribution problem the prior session flagged is *worse* here, not
better. Any difference on a shared page is either a Merlin change or an Asus change
made across four maintenance cycles.

However — this session had a lever the prior one did not: **a second generation to
cross-check against.** Where an apparently "Merlin-only" element on the RT-AX88U is
found sitting in RT-BE92U **stock**, it is provably Asus-authored. That test resolves
most of this generation's attribution ambiguity (§6.3) and is the main methodological
gain of the cross-generation pass.

### Headline counts — RT-AX88U stock vs Merlin

| Metric | RT-AX88U | RT-BE92U (for reference) |
|---|---|---|
| `www/` files present in both (excl. `sysdep/`) | 1110 | 1228 |
| — byte-identical | 731 | 971 |
| — differing | 379 (150 `.asp`) | 257 (71 `.asp`) |
| — of which line-ending-only | **0** (verified) | 0 (after CRLF fix) |
| Top-level pages (`.asp`/`.htm`/`.html`) stock / Merlin | 239 / 253 | 239 / 255 |
| — shared / stock-only / Merlin-only | 235 / 4 / 18 | 238 / 1 / 17 |
| Other files: stock-only / Merlin-only (excl. `sysdep/`) | 11 / 42 | 6 / 32 |
| httpd `ej_handlers[]` stock / Merlin | 318 / 338 (**20 Merlin-only, 0 stock-only**) | 350 / 368 (18 / 0) |
| httpd `mime_handlers[]` stock / Merlin | 288 / 304 (**16 Merlin-only, 0 stock-only**) | 342 / 356 (14 / 0) |
| httpd `except_mime_handlers[]` stock / Merlin | 40 / 41 (**1 Merlin-only, 0 stock-only**) | not measured |
| `state.js` `*_support` flags stock / Merlin | 214 / 220 (**6 Merlin-only, 0 stock-only**) | 226 / 230 (4 / 0) |
| nvram keys in `www/` stock / Merlin | 901 / 1028 (141 Merlin-only, 14 stock-only) | 1408 / 1329 (131 / 210) |

**The strict-superset finding replicates.** On both generations, every httpd
`ej_handler`, `mime_handler`, and `except_mime_handler` present in stock is also
present in Merlin. Zero removals, both times.

The higher differing-file ratio on the RT-AX88U (379/1110 vs 257/1228) is not noise —
all 379 were confirmed to differ after normalising line endings. It reflects the wider
GPL gap plus a large Merlin rewrite of the Traffic Monitor pages landed in 3004.388.11.

---

## 2. Provenance

| Source | Obtained | Where / how | Status |
|---|---|---|---|
| Asus GPL source, RT-AX88U | **Yes** | asus.com support downloads, product `RT-AX88U` (`pdid=9912`, `pdhashedid=pJOKxTNGAGts4Qp0`), OS filter **"Others"** (`osid=8`) → category "Source Code". Direct URL: `https://dlcdnets.asus.com/pub/ASUS/wireless/RT-AX88U/GPL_RT_AX88U_300438824209.zip` | **Verified** — 1,190,491,478 bytes, `sha256 f941495971a5c104094e86863c240d31997bcf1b9a8ce813add687b07e1f2da7`. Saved to `RAW/stock-ax88u/`. Two GPL versions published: 388_24209, 388_22525. |
| Firmware image extraction (fallback) | **Not needed** | The GPL path succeeded, so the documented fallback (download the `.trx`, unpack squashfs read-only) was **not exercised**. No firmware image was downloaded, no extraction tooling installed, nothing flashed. | **Not applicable** |
| Merlin clone, RT-AX88U | **Yes** | `git clone --no-checkout --depth 1 --branch 3004.388.11 https://github.com/RMerl/asuswrt-merlin.ng.git` into `RAW/merlin-ax88u/` | **Verified** — `git describe` = `3004.388.11`, commit `280221387b…` |
| RT-BE92U stock + Merlin | Pre-existing | `RAW/stock/`, `RAW/merlin/` from the prior session; working lists in `RAW/compare/` | Reused as-is, unmodified |

### Acquisition notes (deviations worth recording)

- **The Asus support API keys off `pdid`, not `pdhashedid`.** Supplying the RT-AX88U
  hashed ID with the RT-BE92U's `pdid` returned RT-BE92U data. The numeric `pdid=9912`
  is not present in the page HTML in any greppable form (the Nuxt payload is minified
  with positional variable substitution), so it was recovered by loading the support
  page in the in-app browser and reading the `GetPDDrivers` network request. **Only the
  Global region page was consulted** — it yielded the archive directly, so no second
  regional page was required, matching the prior session's outcome.
- **Known issue applied up front, and it was still necessary.** `--no-checkout` was used
  so git never attempted to write the reserved `aux.c` path; the tree was then
  materialised with `git -c core.protectNTFS=false archive HEAD <paths> | tar -x`.
- **New Windows hazard, not seen last session: dangling symlinks.** `tar` failed on
  symlinks whose targets fell outside the extracted path subset — 2 entries on the
  Merlin side (`sysdep/RT-AC5300/www/qis`, `sysdep/RT-AC86U/www/qis`) and 7 on the stock
  side (`sysdep/RT-AC68A`, `RT-N10PV2`, `RT-AC59_CD6N`, `RT-AC59U_V2`, `RT-N10+`,
  `RT-N10D1`, `RT-AX82_XD6S/www/qis`). `tar` exits non-zero but continues; verified
  2135 of 2137 tracked `www/` paths landed on the Merlin side. **All 9 are other-model
  `sysdep/` entries and none affect the RT-AX88U comparison.**
- **CRLF discipline held.** `core.autocrlf=false` and `core.eol=lf` were set before
  cloning and before extracting. This was then *verified rather than assumed*: all 379
  differing files were re-compared with `\r\n` normalised to `\n`, and **0** turned out
  to be line-ending-only.
- **Python writes CRLF in text mode on Windows.** The generated file lists in
  `RAW/compare-ax88u/` initially carried `\r` line endings, which silently broke shell
  loops consuming them (every path resolved as not-found, and a naive equality check
  read that as "files identical"). The lists were stripped and the affected comparison
  re-run. Anyone re-using these lists from a shell should confirm the line endings first.
- **Page-inventory extension set.** The prior session's page inventory counted
  `.asp` + `.htm` + `.html`. An initial run here counted only `.asp`/`.html`, which
  manufactured ten false "5.0-exclusive" pages (`start_apply.htm`, `error_page.htm`,
  `message.htm`, …). Corrected; §3 and §4 use the prior session's extension set.
- **httpd table extraction targets `web.c` specifically.** Both trees also define
  smaller `ej_handlers[]`/`mime_handlers[]` tables in `basic.c` (30 entries, identical
  across stock and Merlin on both sides). Counting those instead of `web.c`'s produces
  a spurious "no difference" result.
- The GPL tarball was streamed and filtered rather than unpacked in full: the
  244,600-entry manifest is at `RAW/stock-ax88u/stock_manifest.txt`, and the 5,258
  entries under `release/src/router/{www,httpd,shared}` were extracted to
  `RAW/stock-ax88u/extracted/`. Nothing was flashed, mounted, or executed.
- Working comparison lists are in `RAW/compare-ax88u/`. All acquisition output is
  uncommitted (`RAW/` is gitignored).

---

## 3. RT-AX88U — stock vs Merlin

### 3.1 Stock-only pages

| Page | Notes |
|---|---|
| `DNSFilter.asp` | Replaced by Merlin's `DNSDirector.asp`, exactly as on the RT-BE92U. **Merlin-attributed** (named in `Changelog-NG.txt`). |
| `ajax_oauth.asp` | Removed alongside AiCloud/OAuth. **Merlin-attributed** — 3004.388.11 removes AiCloud; `oauth_google_refresh_token` is correspondingly a stock-only nvram key. |
| `asus_eula.htm` | **Attribution ambiguous — likely Asus.** See §6.3. |
| `tm_eula.htm` | **Attribution ambiguous — likely Asus.** See §6.3. |

Also stock-only, non-page: `css/asus_eula.css`, `js/asus_eula.js`,
`css/internetSpeed_white_theme.css`, `fbwifi/index.asp`, `fbwifi/jquery.js`,
`fonts/ROG_Fonts-Regular.{otf,woff}`.

> The ROG fonts are **stock-only on the RT-AX88U but Merlin-only on the RT-BE92U**.
> Likewise `images/logo_GearUp_console@1x.png` and `images/speedtest/linkspeed_dark.png`
> are stock-only on the RT-BE92U and Merlin-only on the RT-AX88U. These are the same
> Asus assets appearing on whichever side happens to hold the newer GPL vintage.
> **Per-asset "stock-only"/"Merlin-only" labels track source vintage, not distribution.
> Do not use them for feature detection.**

### 3.2 Merlin-only pages (18)

| Page | Also Merlin-only on RT-BE92U? |
|---|:-:|
| `Advanced_VPNDirector.asp` | ✅ |
| `Advanced_VPNStatus.asp` | ✅ |
| `Advanced_OpenVPNClient_Content.asp` | ✅ |
| `ajax_vpn_status.asp` | ✅ |
| `DNSDirector.asp` | ✅ |
| `UploadingJFFS.asp` | ✅ |
| `Tools_Sysinfo.asp` | ✅ |
| `ajax_sysinfo.asp` | ✅ |
| `ajax_wificlients.asp` | ✅ |
| `Tools_OtherSettings.asp` | ✅ |
| `Main_TrafficMonitor_monthly.asp` | ✅ |
| `Main_TrafficMonitor_settings.asp` | ✅ |
| `ajax_gettcdata.asp` | ✅ |
| `ajax_conntrack.asp` | ✅ |
| `QoS_Stats.asp` | ✅ |
| `Advanced_AiDisk_NFS.asp` | ✅ |
| `Advanced_Wireless_Survey.asp` | ⚠️ present on RT-BE92U only under `sysdep/FUNCTION/SITE_SURVEY/`, not at `www/` root. Same feature, different source placement — installed to `www/` by the Makefile on both. |
| `GearUpAccelerator.asp` | ❌ **Not Merlin.** Absent from all RT-BE92U trees and unmentioned in Merlin's changelog. Almost certainly an Asus 388-branch feature inherited via GPL 25575. See §6.3. |

Merlin-only supporting assets: `js/trafmon.js`, `js/chart.min.js`,
`js/chartjs-plugin-zoom.min.js`, `js/hammer.min.js`, `js/qrcode.min.js`, `base64.js`,
`images/merlin-logo.png`, `images/letsencrypt.svg`, `ajax/ouiDB.json`,
`ajax/logFilter.json`, `ajax/dns_db.json`, `ajax/extend_custom_icon.json`,
`js/asus_policy.js`.

Notably `Main_Security_Change_Notification.asp` — Merlin-only on the RT-BE92U — has
**no counterpart on the RT-AX88U**.

### 3.3 `state.js` — explicit treatment

`state.js` is the feature-detection surface. It is **not** a Merlin invention: both
stock trees ship it, and Merlin edits it in place (478 changed lines on the RT-AX88U,
165 on the RT-BE92U).

| | stock | Merlin | Merlin-only | stock-only |
|---|---:|---:|---:|---:|
| RT-AX88U `*_support` flags | 214 | 220 | **6** | **0** |
| RT-BE92U `*_support` flags | 226 | 230 | **4** | **0** |

**Neither generation removes a single stock support flag.** `state.js` is a strict
superset in Merlin on both.

Merlin-added flags:

| Flag | RT-AX88U | RT-BE92U | Note |
|---|:-:|:-:|---|
| `cake_support` | ✅ | ✅ | Cake QoS |
| `igd2_support` | ✅ | ✅ | UPnP IGDv2 |
| `nfsd_support` | ✅ | ✅ | NFS exports |
| `ntpd_support` | ✅ | ✅ | Local NTP server |
| `v6option_support` | ✅ | — | Merlin back-added it on 4.0; **Asus ships it natively in RT-BE92U stock** |
| `gu_support` | ✅ | — | GearUp; pairs with `GearUpAccelerator.asp`, attribution uncertain (§6.3) |

### 3.4 `menuTree.js` — explicit treatment

**The runtime path is stable across both generations; the source filename is not.**

Both generations use the identical install-time mechanism in `www/Makefile`: exactly
one `require/menuTrees/menuTree_*.js` variant is renamed to
`require/modules/menuTree.js`, then `require/menuTrees/` is deleted outright. **The
served navigation file is always `/require/modules/menuTree.js` on both platforms.**

What differs is which source variant feeds it:

| | Selection predicate | Variant used for this model | Merlin Δ lines |
|---|---|---|---:|
| RT-BE92U (5.0) | UI-skin: `RTCONFIG_ROG_UI` / `UI4` / `TUF_UI` / `GS_UI`, else default | `require/menuTrees/menuTree.js` | 68 |
| RT-AX88U (4.0) | Model overrides first, then `RTCONFIG_BWDPI` + `MODELS_HAVE_TRAFFIC_ANALYZER` | `require/menuTrees/menuTree_bwdpi_traffic_analyzer.js` | 88 |

> **Trap for anything keying off the source tree:** the 3004.388 branch has **no
> `require/menuTrees/menuTree.js` at all**. Its `require/modules/menuTree.js` *does*
> exist in-tree but is a stale 2023 template — **byte-identical between stock and
> Merlin**, and overwritten at install time. Reading either of those files to determine
> RT-AX88U navigation yields nothing. The live source is
> `menuTree_bwdpi_traffic_analyzer.js`. (`menuTree_ROG.js` also differs, by 71 lines,
> for the ROG-skin models; `menuTree_no_bwdpi.js` and
> `menuTree_bwdpi_no_traffic_analyzer.js` are untouched by Merlin.)

Merlin's RT-AX88U navigation changes, and whether they match the RT-BE92U:

| Change | RT-AX88U | RT-BE92U |
|---|:-:|:-:|
| Adds `menu_Sysinfo` group → `Tools_Sysinfo.asp` | ✅ | ✅ |
| `DNSFilter.asp` → `DNSDirector.asp` (stock entry commented out) | ✅ | ✅ |
| Adds VPN Status / VPN Director / OpenVPN tabs | ✅ | ✅ |
| Adds `Advanced_AiDisk_NFS.asp` ("NFS Exports") | ✅ | ✅ |
| Adds `Tools_OtherSettings.asp` ("Tweaks") | ✅ | ✅ |
| Adds `Advanced_Wireless_Survey.asp` ("Site Survey") | ✅ | ✅ |
| Adds `QoS_Stats.asp` ("Classification") | ✅ | ✅ |
| Adds TrafficMonitor monthly / settings tabs | ✅ | ✅ |
| Splits combined VPN gate into per-protocol checks | ✅ | ✅ |
| Adds Security Update Notification tab | ❌ | ✅ |
| Adds `WiFi_Insight.asp`, gated on `wifiRadar_support` | ✅ | ❌ |
| Gates `menu_GameBoost` on `isSupport("gu_accel")` | ✅ | ❌ |
| Gates `cloud_router_sync.asp` on `rrsut_support` | ✅ | ❌ |

The gating idiom is identical on both: a `retArray.push("<page>.asp")` **removal** list
driven by `state.js` flags, with the same per-protocol split
(`pptpd_support`, `openvpnd_support`, `ipsec_srv_support`, `nfsd_support`).

### 3.5 httpd handler additions

`ej_handlers[]`, 20 Merlin-only on the RT-AX88U, 0 stock-only:

`asus_sysinfo`, `bwdpi_conntrack`, `get_connlist_array`, `get_custom_settings`,
`get_ipv6clients_array`, `get_ipv6net_array`, `get_leases_array`, `get_route_array`,
`get_tcclass_array`, `get_tcfilter_array`, `get_upnp_array`, `get_vserver_array`,
`get_wl_status`, `ipt_bandwidth`, `iptmon`, `iptraffic`, `ipv6_pinholes`,
`language_support_list`, `wan_ipv6_network`, `wl_extent_channel`

`mime_handlers[]`, 16 Merlin-only, 0 stock-only:

`**.pac`, `ajax/ouiDB.json`, `application/x-ns-proxy-autoconfig`,
`asus_ally_device.cgi`, `backup_jffs*.tar`, `cacert_key.tar`,
`calendar/jquery-ui.js`, `cert.crt`, `chanspec.js`, `get_ASUS_privacy_policy.cgi*`,
`get_security_update.cgi*`, `jffsupload.cgi*`, `set_ASUS_NEW_EULA.cgi*`,
`set_ASUS_privacy_policy.cgi*`, `set_security_update.cgi*`, `wpad.dat`

`except_mime_handlers[]`, 1 Merlin-only, 0 stock-only: `asus_ally_device.cgi`

**Six of these are provably Asus, not Merlin** — see §6.3. Merlin also adds the same
three httpd source files as on the RT-BE92U: `data_arrays.{c,h}`, `sysinfo.{c,h}`,
`iptraffic.h`.

### 3.6 `www/Makefile` install-time behaviour

Every RT-BE92U Makefile finding reproduces on the RT-AX88U:

- Merlin **deletes** `Advanced_Feedback.asp` at install; stock ships it.
- Stock **deletes** `Advanced_VPN_OpenVPN.asp` at install; Merlin ships it.
  (Hence "shared in source, stock-absent at runtime" — and the 1329-line diff on that
  page is the largest non-library `.asp` divergence here too.)
- Merlin copies `sysdep/FUNCTION/SITE_SURVEY/*` into `www/`.
- Merlin creates `client1.ovpn` **and** `client2.ovpn` symlinks; stock links a single
  unnamed `client.ovpn`.
- Merlin adds `user1.asp`…`user20.asp` symlinks for addon pages (RT-AX88U specific;
  the RT-BE92U report notes the removal of Tomato legacy files instead).

---

## 4. Universal baseline — present in all four combinations

**234 top-level pages** are present in RT-AX88U stock, RT-AX88U Merlin, RT-BE92U stock,
and RT-BE92U Merlin simultaneously. Full list: `RAW/compare-ax88u/universal_pages.txt`.

| Surface | Universal across all four | Evidence |
|---|---:|---|
| Top-level pages (`.asp`/`.htm`/`.html`) | **234** | 4-way set intersection of the page inventories |
| `state.js` `*_support` flags | **213** | 4-way intersection of `*_support` tokens |
| `sysdep/FUNCTION/` groups | **6** — `LIGHT_EFFECT`, `QIS_V2`, `QIS_V3`, `ROG_UI`, `VPNC_V2`, `VPNS_V2` | directory intersection |
| Navigation entry point | **`/require/modules/menuTree.js`** | identical Makefile rename-and-delete idiom on both |
| Feature-detection idiom | **`state.js` flag → `menuTree` `retArray.push()` removal** | identical structure on both |
| httpd routing tables | **`ej_handlers[]` / `mime_handlers[]` / `except_mime_handlers[]` in `httpd/web.c`** | same file, same declaration form |

Representative universal pages (all four): `index.asp`, `Main_Login.asp`,
`Advanced_System_Content.asp`, `Advanced_WAN_Content.asp`, `Advanced_LAN_Content.asp`,
`Advanced_DHCP_Content.asp`, `Advanced_Firewall_Content.asp`,
`Advanced_FirmwareUpgrade_Content.asp`, `Advanced_SettingBackup_Content.asp`,
`Main_DHCPStatus_Content.asp`, `Main_LogStatus_Content.asp`,
`Main_ConnStatus_Content.asp`, `Main_TrafficMonitor_{realtime,daily,last24}.asp`,
`QoS_EZQoS.asp`, `Advanced_VPNClient_Content.asp`,
`Advanced_WireguardClient_Content.asp`, `device-map/*`, `start_apply.htm`,
`error_page.htm`, `message.htm`.

**A universal-baseline extension can rely on:** the `/require/modules/menuTree.js`
navigation contract, `state.js` support flags as the gating surface, the
`httpd/web.c` handler tables, and these 234 pages — subject to §6.1.

---

## 5. ASUSWRT 5.0 / Wi-Fi 7 exclusive groups

Present on the RT-BE92U (stock and/or Merlin) with no equivalent on the RT-AX88U.

### 5.1 Self-Defined Networks (SDN) — ⚠️ flagged as requested

**SDN is ASUSWRT 5.0 exclusive, and it is an Asus feature, not a Merlin one.**

- `sysdep/FUNCTION/SDN/` exists in **both** RT-BE92U trees — stock *and* Merlin.
- It is **entirely absent** from both RT-AX88U trees.
- Contents: `SDN.asp`, `MLO.asp`, `SDN/sdn.js`, `SDN/mlo.js`, `ajax/freewifi_tos.json`,
  and a large `images/New_ui/SDN/{dark,light}_theme/` asset set.
- Backing flag: **`mtlancfg_support`** — present in RT-BE92U stock and Merlin, absent
  from both RT-AX88U trees. (The `_support` name is `mtlancfg_support`, *not*
  `sdn_support`; nvram keys use the `sdn_*` and `apg_*` prefixes.)
- Surface size: 58 `.asp`/`.js` files reference `sdn_`/`SDN`/`mtlan` on the RT-BE92U
  versus 4 on the RT-AX88U — and those 4 are unrelated captive-portal and QIS-mobile
  templates, i.e. vestigial token collisions, not the feature.
- nvram families with no RT-AX88U counterpart: `sdn_*` (`sdn_access_json`,
  `sdn_access_profile`, `sdn_access_rl*`, `sdn_addr`, `sdn0_rl`, …) and the
  `apg_*` / `apgx_*` access-point-group family (`apg_ssid`, `apg_security`, `apg_mlo`,
  `apg_bw_limit`, `apg_maclist`, `apg_macmode`, `apg_sched`, `apg_hide_ssid`,
  `apg_11be`, `apg_iot_max_cmpt`, …).

**Any SDN handling in the extension is RT-BE92U-generation-only and must be feature-gated.**
Because SDN ships in stock too, `mtlancfg_support` — not a Merlin marker — is the
correct detection flag.

### 5.2 `sysdep/FUNCTION/` groups with no RT-AX88U equivalent (12)

`ADGUARDDNS_UI`, `BUSINESS_UI`, `GS_UI`, `MULTISERVICE_WAN`, `MULTI_FUNC_BTN`,
`PC_SCHED_V1`, `RWD_UI`, **`SDN`**, `TS_UI`, `TUF_UI`, `UI4`, `WL_SCHED_V1`

All 12 are present in RT-BE92U **stock**, so all are Asus platform features.

> `PC_SCHED_V1` / `WL_SCHED_V1` (5.0) are the counterparts of `PC_SCHED_V3` /
> `WL_SCHED_V2` (4.0) — see §5.4. The version numbers move *downward* on the newer
> platform; do not read them as an upgrade sequence.

### 5.3 Pages exclusive to the 5.0 generation (5)

| Page | Stock | Merlin | Note |
|---|:-:|:-:|---|
| `Advanced_GRE_Content.asp` | ✅ | ✅ | GRE tunnels; flag `gre_support` |
| `Advanced_VLAN_Profile_Content.asp` | ✅ | ✅ | VLAN profiles (SDN-adjacent) |
| `Advanced_VLAN_Switch_Content.asp` | ✅ | ✅ | VLAN switch config |
| `Advanced_Web_Account_Binding.asp` | ✅ | ✅ | Asus account binding |
| `Main_Security_Change_Notification.asp` | ❌ | ✅ | **The only genuinely Merlin-exclusive 5.0 page.** |

### 5.4 `state.js` flags exclusive to the 5.0 generation (13)

All 13 are present in RT-BE92U **stock** — i.e. Asus platform capability flags, none
Merlin-authored:

`agile_dfs_support`, `app_action_support`, `asus_support`, `band6g_2_support`,
`dashboard_support`, `gre_support`, `maxassoc_support`, `mtk_support`,
**`mtlancfg_support`**, `mtppp_support`, `no_zero_wait_dfs_support`,
`v6option_support`, `wbmenu_support`

`v6option_support` is the interesting one: **Asus ships it in RT-BE92U stock, but on the
RT-AX88U it exists only because Merlin added it.** A flag being "Merlin-only" is
therefore generation-dependent and not a stable Merlin marker.

---

## 6. ASUSWRT 4.0 / Wi-Fi 6/6E exclusive groups

Markedly smaller than the 5.0 side — the 4.0 tree is essentially a subset, plus
legacy carry-over.

### 6.1 `sysdep/FUNCTION/` groups with no RT-BE92U equivalent (2)

`PC_SCHED_V3`, `WL_SCHED_V2`

Both are present in RT-AX88U stock. These are **renamed/renumbered equivalents** of the
5.0 tree's `PC_SCHED_V1` / `WL_SCHED_V1`, not distinct features: parental-control
scheduling and wireless scheduling exist on both generations under different
`FUNCTION` directory versions. Merlin's RT-AX88U Makefile overlays
`WL_SCHED_V2/Advanced_WAdvanced_Content.asp` exactly as the RT-BE92U build overlays its
`WL_SCHED_V1` equivalent.

### 6.2 Pages exclusive to the 4.0 generation (6)

| Page | Stock | Merlin | Note |
|---|:-:|:-:|---|
| `QIS_wizard_m.htm` | ✅ | ✅ | Legacy mobile QIS wizard; dropped in 5.0 |
| `asus_eula.htm` | ✅ | ❌ | Legacy EULA page (+ `css/asus_eula.css`, `js/asus_eula.js`) |
| `tm_eula.htm` | ✅ | ❌ | Trend Micro EULA page |
| `ajax_oauth.asp` | ✅ | ❌ | OAuth polling endpoint; removed by Merlin with AiCloud |
| `GearUpAccelerator.asp` | ❌ | ✅ | Not in Merlin's changelog — see §6.3 |
| `Advanced_Wireless_Survey.asp` | ❌ | ✅ | **Not a real exclusive** — the RT-BE92U ships the same page under `sysdep/FUNCTION/SITE_SURVEY/`; both Makefiles install it to `www/`. A source-layout difference only. |

Also 4.0-only: the `fbwifi/` directory (Facebook Wi-Fi, stock), the RT-AX88U Gundam
Edition skin assets under `sysdep/RT-AX88U/www/images/gundam_*`, and `WiFi_Insight.asp`
model overlays across ~15 `sysdep/<model>/` directories.

### 6.3 4.0-generation elements that are Asus, not Merlin

This is where the cross-generation check does real work. Six elements appear
"Merlin-only" in the RT-AX88U stock-vs-Merlin diff, but are present in **RT-BE92U
stock** — proving Asus authored them, and that they reached Merlin's RT-AX88U build
through GPL 388_25575:

| Element | Table | In RT-BE92U stock? |
|---|---|:-:|
| `get_security_update.cgi*` / `set_security_update.cgi*` | `mime_handlers[]` | ✅ |
| `get_ASUS_privacy_policy.cgi*` / `set_ASUS_privacy_policy.cgi*` | `mime_handlers[]` | ✅ |
| `set_ASUS_NEW_EULA.cgi*` | `mime_handlers[]` | ✅ |
| `asus_ally_device.cgi` | `mime_handlers[]` + `except_mime_handlers[]` | ✅ |
| `language_support_list` | `ej_handlers[]` | ✅ |
| `wan_ipv6_network` | `ej_handlers[]` | ✅ |

The same logic explains the disappearing EULA pages: `asus_eula.htm` and `tm_eula.htm`
exist in RT-AX88U stock (24209) but in **neither** RT-BE92U tree. Asus had already
replaced the static EULA pages with the `set_ASUS_NEW_EULA.cgi` /
`*_ASUS_privacy_policy.cgi` endpoint pair by the 5.0 drop. Their absence from Merlin's
RT-AX88U build is therefore **most likely an inherited Asus removal, not a Merlin
removal** — which matters, because it means they are not evidence against the
"Merlin never removes" pattern (§7).

`GearUpAccelerator.asp` + `gu_support` remain **unresolved**: unmentioned in Merlin's
changelog (so not Merlin-attributed), but absent from the RT-BE92U trees as well (so
the cross-generation test cannot confirm them either). Best reading: an Asus 388-branch
feature added between 24209 and 25575 that has no 3006-branch counterpart. Stock ships
`GearAccelerator.asp` on all four; Merlin's RT-AX88U tree ships both it and
`GearUpAccelerator.asp`.

---

## 7. Stock-to-Merlin pattern consistency

**The pattern found on the RT-BE92U holds on the RT-AX88U.** Merlin is additive; it
does not remove routing surface.

| Property | RT-BE92U (5.0) | RT-AX88U (4.0) | Consistent? |
|---|---|---|:-:|
| `ej_handlers[]` a strict Merlin superset | 350 → 368, 0 removed | 318 → 338, 0 removed | ✅ |
| `mime_handlers[]` a strict Merlin superset | 342 → 356, 0 removed | 288 → 304, 0 removed | ✅ |
| `except_mime_handlers[]` a strict superset | not measured | 40 → 41, 0 removed | ✅ (new) |
| `state.js` support flags a strict superset | 226 → 230, 0 removed | 214 → 220, 0 removed | ✅ |
| Navigation gating idiom | `state.js` flag → `retArray.push()` removal list | identical | ✅ |
| Navigation runtime path | `/require/modules/menuTree.js` | identical | ✅ |
| Navigation *source* file | `menuTrees/menuTree.js` | `menuTrees/menuTree_bwdpi_traffic_analyzer.js` | ❌ renamed |
| `DNSFilter.asp` → `DNSDirector.asp` swap | ✅ | ✅ | ✅ |
| Merlin deletes `Advanced_Feedback.asp` at install | ✅ | ✅ | ✅ |
| Stock deletes `Advanced_VPN_OpenVPN.asp` at install | ✅ | ✅ | ✅ |
| Merlin installs `SITE_SURVEY` into `www/` | ✅ | ✅ | ✅ |
| Merlin's core feature set (VPN Director, Sysinfo, Tweaks, NFS, JFFS, rstats TrafficMonitor, QoS Stats, conntrack/iptraffic) | ✅ | ✅ — 16 of 18 Merlin-only pages match one-for-one | ✅ |
| Merlin's GPL base newer than any published Asus GPL | ✅ (1 drop) | ✅ (**4 drops**) | ✅, worse |
| AiCloud: changelog says removed, `cloud_*.asp` still in `www/` | ✅ | ✅ — identical six pages, present in stock and Merlin alike | ✅ |

**Page-level removals across both generations: `DNSFilter.asp` (deliberate,
changelog-attributed, superseded by `DNSDirector.asp`) and `ajax_oauth.asp`
(RT-AX88U only, follows the AiCloud removal).** The two EULA pages look like removals
but are attributable to Asus (§6.3). Nothing else disappears.

**Practical conclusion for the extension:** the stock→Merlin relationship is additive
on both generations, so Merlin detection can safely be done by probing for *added*
surface (`nfsd_support`, `ntpd_support`, `cake_support`, `igd2_support`, the
`get_custom_settings` / `asus_sysinfo` / `iptmon` handlers, `DNSDirector.asp`) rather
than by testing for anything absent. **The generation split, not the stock/Merlin
split, is what needs the heavier feature-gating.**

---

## 8. Open unknowns

### Carried forward from the RT-BE92U session — still outstanding, not addressed here

1. **The AiCloud source-presence-versus-changelog contradiction remains unresolved.**
   Merlin's changelog states AiCloud was removed (3006.102.7 on the 5.0 branch,
   3004.388.11 on the 4.0 branch), yet `cloud_main.asp`, `cloud_sync.asp`,
   `cloud_settings.asp`, `cloud_status.asp`, `cloud_syslog.asp`, and
   `cloud_router_sync.asp` are present in **all four** trees. This session **confirmed
   the contradiction reproduces identically on the RT-AX88U** but did not resolve it —
   removal happens outside `www/`, and whether these pages resolve, 404, or redirect on
   a running unit still requires live verification, which was out of scope.
2. **The unaudited `web.c` auth/session diff remains outstanding.** No line-level audit
   of Merlin's login, captcha, security-log, CSRF, `do_auth`, or `action_mode` handling
   was performed on either generation. The RT-BE92U diff was ~1517 lines; the RT-AX88U
   diff was not measured at that granularity. Nothing here establishes whether session
   or token handling differs in ways affecting an extension's request flow.

### New to this session

3. **The 24209 → 25575 attribution gap (four Asus drops).** Wider than the RT-BE92U's
   single-drop gap. The cross-generation test in §6.3 resolves six httpd entries and
   the two EULA pages, but it can only resolve elements that also exist on the 5.0
   side. Among the 379 differing files there are almost certainly further inherited
   Asus changes that are indistinguishable from Merlin changes from these sources alone.
4. **`GearUpAccelerator.asp` and `gu_support` are unattributed** (§6.3) — not in
   Merlin's changelog, not in the RT-BE92U trees. Likely Asus, not proven.
5. **Source presence ≠ served page — applies to all four trees.** Every "present"
   claim here is a source-tree fact. What lands in `/www` is decided by `www/Makefile`
   conditionals (`RTCONFIG_*`, `HND_ROUTER`, `BUILD_NAME`,
   `MODELS_HAVE_TRAFFIC_ANALYZER`) that cannot be evaluated without each model's build
   config. This is why §3.4's `menuTree` finding matters: the file that exists in the
   tree is not the file that gets served.
6. **`state.js` flag *values* still cannot be read statically** — on either generation.
   The flag *names* are now established as stable (213 universal, and 0 removals by
   Merlin on both), but their runtime values come from nvram / `rc_support` and must be
   sampled live. **This remains the correct feature-detection surface and it remains
   unsampled.**
7. **No RT-AX88U hardware exists in this environment.** Nothing in this report has been
   behaviourally verified. The Merlin ref used is current stable
   (`3004.388.11`), which corresponds to no particular deployment.
8. **Both Merlin worktrees are partial** (`www`, `httpd`, `shared` only). Comparisons
   involving `rc/`, `shared/defaults.c` nvram default tables, `libbcm`, or `bwdpi` were
   not performed on either generation. Nine dangling other-model `sysdep/` symlinks were
   skipped during extraction (§2).
9. **The 4.0 `menuTree` variant selection was read, not evaluated.** The RT-AX88U is
   assumed to take the `RTCONFIG_BWDPI=y` + in-`MODELS_HAVE_TRAFFIC_ANALYZER` branch
   (hence `menuTree_bwdpi_traffic_analyzer.js`). That inference follows from the model
   shipping Trend Micro traffic analysis, but `MODELS_HAVE_TRAFFIC_ANALYZER` was not
   resolved from the build config. If it is wrong, the correct source variant is
   `menuTree_bwdpi_no_traffic_analyzer.js` — which Merlin leaves **unmodified**, and
   the RT-AX88U would then get stock navigation.

---

*Generated from static source comparison, 2026-07-24. No live router contacted.
Uncommitted, as instructed.*
