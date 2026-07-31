/**
 * Operation Mode (Advanced_OperationMode_Content.asp) — Router / Repeater /
 * Access Point / Media Bridge / WISP / AiMesh Node switching.
 *
 * THIS IS THE HIGHEST-STAKES DEFERRED FEATURE IN THE PROJECT. Read this
 * entire header before touching writeExclusion, buildFields, or rcService on
 * this page. Every claim below is cited against
 * scratchpad/research/08-opmode.md (the operation-mode research brief,
 * itself cited against RAW/merlin/release/src/router/{www,httpd,shared}).
 *
 * -----------------------------------------------------------------------
 * (a) WHY writeExclusion: 'wan' — the closest existing hard category, and
 *     hard-block is deliberate, not a placeholder.
 * -----------------------------------------------------------------------
 * write-policy.ts hard-blocks five categories (wireless, wan, dhcp, vpn,
 * firewall) UNCONDITIONALLY — independent of the global read-only interlock
 * (lib/write-policy.ts:12-19). Operation-mode's confirmed write set (below)
 * spans wireless keys (SSID/auth/crypto/wlc_*), dhcp keys (lan_proto flips
 * static<->dhcp), AND wan keys (wans_dualwan, wan_hwaddr_x) simultaneously —
 * any of the three tags would be factually defensible. 'wan' is chosen
 * because every mode transition is, at its core, a redefinition of *what
 * plays the WAN role*: Router has a routed WAN port; AP/Repeater/Media
 * Bridge have no routed WAN role at all (traffic bridges through LAN); WISP
 * moves the WAN role onto a wireless uplink and explicitly disables the
 * physical port (wans_dualwan="wan none"). That is a categorically larger
 * blast radius than a same-segment wireless key change or dhcp lease-range
 * edit — it is what produces the "stranded on an unknown network" failure
 * mode in (e) below. Tagging this page 'wireless' or 'dhcp' would undersell
 * that risk to a reviewer skimming the category. (Caveat carried from the
 * brief: 'wan' elsewhere in this project means WAN *protocol* settings
 * (PPPoE/static/DNS) — this page's use of the tag is topology-level, a
 * wider blast radius than that, not a narrower one.)
 *
 * -----------------------------------------------------------------------
 * (b) Mode -> nvram key matrix, write-time values (class (a) = literal
 *     router_defaults[]/defaults.c entry unless noted). ALL WRITE FIELDS
 *     BELOW ARE DOCUMENTATION ONLY — this page ships no write block; see
 *     "SCOPE" at the end of this comment.
 * -----------------------------------------------------------------------
 * Confirmed in QIS_V3 mobile/js/handler.js (the wizard chain every
 * transition except RP/MB->Router funnels through — see (d)):
 *
 *   Router (RT):   sw_mode=1, wlc_psta=0, wlc_dpsta=0, wlc_band="",
 *                  mlo_rp=0, mlo_mb=0
 *                  [handler.js:3200-3229, goTo.rtMode]
 *   Repeater (RP): sw_mode=3 (concurrep/amas+bcmwifi) or 2 (non-Broadcom),
 *                  wlc_psta=2 (bcmwifi) or 0 (non-bcm),
 *                  wlc_dpsta=2|1|0 (chip/mode dependent)
 *                  [handler.js:3231-3256, goTo.rpMode]
 *   AP:            sw_mode=3, wlc_psta=0, wlc_dpsta=0, mlo_rp=0, mlo_mb=0
 *                  [handler.js:3277-3292, goTo.apMode]
 *   Media Bridge:  sw_mode=2 (qcawifi||rawifi) or 3 (else), wlc_psta=1,
 *                  wlc_dpsta=0
 *                  [handler.js:3294-3313, goTo.mbMode]
 *   WISP:          sw_mode=1 (SAME AS ROUTER — see (c)), wlc_psta=0,
 *                  wlc_dpsta=0, wans_dualwan="wan none", wan_unit="0",
 *                  wan_hwaddr_x=""; wlc_band populated later by site-survey
 *                  AP selection (not present in the static write object)
 *                  [qisData.js:183-190 wispObj; handler.js:3258-3275
 *                  goTo.wispMode]
 *   AiMesh Node:   NOT a table write — see (d).
 *
 * All chip-family branches (bcmwifi/qcawifi/rawifi/concurrep/amas) are
 * runtime-conditional in the firmware's own JS, not something this
 * extension can resolve statically from a page def — another reason the
 * write side is out of scope for this pass (see SCOPE).
 *
 * defaults.c citations for every key above: sw_mode (29,31,33,35),
 * wlc_psta (1150,1152), wlc_dpsta (1065,1156,1158), wlc_express (1146),
 * wlc_band (1037), mlo_rp (1062), mlo_mb (1064), cfg_master (4801),
 * lan_proto (2257,2259), lan_ipaddr/lan_ipaddr_rt (2262-2269),
 * lan_netmask/lan_netmask_rt (2274-2275), lan_gateway (2276).
 * wan_hwaddr_x/wan0_hwaddr_x/wans_dualwan/lan_dnsenable_x/lan_dns1_x/
 * lan_dns2_x and the wl0/1/2_ssid|auth_mode_x|crypto|wpa_psk family are
 * "(a), presumed" per the brief — standard defaults-table keys used
 * elsewhere in this codebase but not individually re-verified against a
 * defaults.c line number in this research pass.
 *
 * -----------------------------------------------------------------------
 * (c) WISP read-side nuance — this is why the derived-mode logic below
 *     cannot just switch on sw_mode.
 * -----------------------------------------------------------------------
 * shared/shared.h:2167-2178 (Ralink/QCA) and :2229-2240 (Broadcom) both
 * define:
 *   static inline int __wisp_mode(int sw_mode) {
 *     return (sw_mode == SW_MODE_ROUTER && nvram_invmatch("wlc_band", ""));
 *   }
 * i.e. WISP mode is plain Router mode (sw_mode==1) PLUS a non-empty
 * wlc_band. A reader that only looks at sw_mode will misreport a WISP
 * router as plain Router. deriveOpMode() below replicates this check
 * exactly, matching the server's own ej_get_operation_mode() decision table
 * (httpd/web.c:41773-41837), which is what the native UI's isSwMode()
 * helper actually calls (state.js:258-277) — not the page's separate
 * client-side sw_mode remap, which is used only for that one page's own
 * radio pre-check and diverges from the authoritative helper (see the
 * brief §2b for the full discrepancy).
 *
 * Firmware source bug carried into the read path deliberately: web.c's
 * "ew5" (Express Way 5GHz) and "hs" (Hotspot) branches compare int nvram
 * values against char literals ('2','0','5') and can never match in
 * practice (web.c:41818-41827). deriveOpMode() below does NOT reproduce
 * that bug — it treats wlc_express=='2' as Express Way 5GHz correctly,
 * since faithfully reproducing a firmware bug in a *read-only* diagnostic
 * would only make this page less accurate for no safety benefit. This is
 * the one deliberate divergence from the server helper's literal behavior,
 * and it is documented here so a future reader isn't surprised by the
 * mismatch if they diff against ej_get_operation_mode() directly.
 *
 * -----------------------------------------------------------------------
 * (d) AiMesh Node — no write surface, by design, not by omission.
 * -----------------------------------------------------------------------
 * The brief searched the entire www tree for a literal sw_mode=5 write and
 * found none. Advanced_OperationMode_Content.asp's AiMeshMode radio
 * (nvram value "5") redirects to QIS_wizard.htm?flag=amasnode_page ->
 * goTo.asNode() -> apply.amasNode() (handler.js:1502-1513), whose "become a
 * node" action calls goTo.amasRestore() (handler.js:4868-4890). That
 * function does NOT build a qisPostData object and submit through
 * validate_apply() at all — it polls httpApi.isAlive() against the
 * router's FACTORY-DEFAULT lan_ipaddr (httpApi.nvramDefaultGet), which is
 * the signature of a restore-to-defaults + re-onboard flow, not a settings
 * write. Turning an already-configured router into an AiMesh node is
 * therefore, on this firmware generation, equivalent in blast radius to a
 * factory reset (total loss of SSIDs/passwords/VPN/port-forwards/guest
 * networks on the node-ified device) — qualitatively worse than every
 * other transition in this table, which only risk a reachability blip.
 * This page deliberately ships NO write surface for AiMesh Node, on any
 * confidence tier: there is no confirmed nvram key combination to write in
 * the first place, and even if one were found, a factory-reset-class
 * action does not belong behind this page's Apply button. The derived-mode
 * read path can still surface "the router currently reports Hotspot
 * (sw_mode==5)" if that value is ever observed, per the unconfirmed overlap
 * noted in (f), but there is no "switch to AiMesh Node" option to select.
 *
 * -----------------------------------------------------------------------
 * (e) REACHABILITY RISK — why this is the highest-stakes item in the
 *     deferred list. Read this before ever lifting the hard exclusion.
 * -----------------------------------------------------------------------
 * A mode switch can move the router's LAN interface to a DHCP-assigned
 * address on a network segment the operator's current browser tab cannot
 * reach, and the native firmware itself has NO address-migration redirect
 * for that case:
 *
 *  - AP/Repeater/Media Bridge with DHCP LAN addressing set lan_proto="dhcp"
 *    (handler.js:3910-3912, goTo.lanDHCP) — the router becomes a DHCP
 *    *client* of whatever network it's plugged into. Its new address is
 *    unknown to the wizard, to this extension, and to the operator.
 *  - The firmware's OWN remedy, in its own strings (www/EN.dict), is to
 *    tell the user to go run an external tool: deviceDiscorvy2 (Repeater,
 *    EN.dict:2049), deviceDiscorvy3 (AP, EN.dict:2050), deviceDiscorvy4
 *    (Media Bridge, EN.dict:2052) all read (paraphrased): "the DHCP-
 *    assigned IP address changes; use the Device Discovery Utility to find
 *    it." There is no in-UI recovery path — the router's own UI admits
 *    this case is not automatable.
 *  - The QIS_V3 wizard's own "wait for the router, then continue" finish
 *    flow (goTo.Finish/goTo.leaveQIS, handler.js:4684-4800, 4726-4791,
 *    5388-5400) polls httpApi.isAlive() against the BROWSER'S CURRENT
 *    ORIGIN and finally navigates to location.href="/" — again the current
 *    origin. It never attempts to discover or redirect to a new address.
 *    This is the wizard's finish flow admitting the same limitation from
 *    the other direction.
 *  - The one path that DOES have a coherent redirect (start_apply.htm:
 *    927-933's redirect() function, RP/MB -> Router only, see (g) below)
 *    only works because switching to Router mode restores the fixed
 *    lan_ipaddr_rt default, and even then it's a same-subnet assumption
 *    the code does not itself verify.
 *  - WISP mode's risk is structural rather than address-related:
 *    wans_dualwan="wan none" disables the physical WAN port as a routing
 *    interface BEFORE the wireless uplink's credentials are validated
 *    (site-survey AP-password entry happens after this object is already
 *    queued). Wrong credentials can leave the router with no route to the
 *    internet and no WAN-port fallback until the operator re-enters the
 *    wizard from the LAN side.
 *
 * CONSEQUENCE: a live test of this write path is NOT safe to attempt from
 * an ordinary remote/browser session. It must be planned with (1) physical
 * access to the device, and (2) a working address-discovery method (the
 * router's own suggested Device Discovery Utility, ARP/mDNS scanning, or
 * equivalent) lined up BEFORE the write is ever submitted. This applies
 * even after a future decision to clear the 'wan' hard-exclusion for this
 * page specifically — clearing the category tag does not change any of the
 * facts above.
 *
 * -----------------------------------------------------------------------
 * (f) Per-mode worst case, for that future supervised session.
 * -----------------------------------------------------------------------
 *  - Router (from RP/MB): action_script="restart_all". Best-documented
 *    recovery case, and still only a same-subnet assumption (g).
 *  - AP: action_script="reboot". Worst case: LAN becomes a DHCP client,
 *    address unknown; NAT/firewall/DHCP-server off by default in this mode.
 *  - Repeater / Express Way 2.4 / Express Way 5: action_script="reboot".
 *    Same DHCP-address risk as AP, plus a live test must supply valid
 *    upstream AP credentials via the wizard's site-survey step or the
 *    transition stalls mid-wizard without ever calling nvramSet.
 *  - Media Bridge: action_script="reboot". Same DHCP-address risk, plus an
 *    explicit native warning (OP_MB_desc9, EN.dict:569) that the WAN port
 *    must be physically unplugged first — untested behavior with the WAN
 *    port still connected is unspecified.
 *  - WISP: action_script="reboot". wans_dualwan="wan none" structurally
 *    disables the WAN port; worst case is total loss of internet routing,
 *    recoverable only via LAN-side wizard re-entry.
 *  - AiMesh Node: not a reboot/restart_all action at all — a confirm-gated
 *    restore-to-factory-defaults flow (d). Worst case is total loss of the
 *    device's existing configuration. Strictly higher risk than the other
 *    five; if ever exercised, must be last and on disposable hardware.
 *
 * -----------------------------------------------------------------------
 * (g) The QIS-wizard-only transitions, and what this page does instead.
 * -----------------------------------------------------------------------
 * Natively, 5 of 6 transitions never reach a direct-submit form at all —
 * Advanced_OperationMode_Content.asp's saveMode() (lines 376-442) redirects
 * to /QIS_wizard.htm?flag=<mode> for everything except RP/MB -> Router,
 * which alone self-submits to /start_apply.htm (applyRule() guard at line
 * 445: sw_mode==1 && (sw_mode_orig=='2'||sw_mode_orig=='4')). Inside the
 * wizard, every goTo.<mode>() function builds the SAME qisPostData object
 * documented in (b) above and commits it via
 * httpApi.nvramSet(setRestartService(qisPostData), goTo.Finish) — confirmed
 * at handler.js:966 (apply.lanStatic), :1413 (post-survey commit), :3937
 * (goTo.lanDHCP). httpApi.nvramSet() (www/js/httpApi.js:227-252) POSTs
 * JSON.stringify(postData) to /applyapp.cgi (httpApi.js:236), which per
 * this project's documented write-path model calls the identical
 * table-driven validate_apply() (web.c:4276 onward, action_mode=="apply"
 * branch at web.c:13192-13195) that the RP/MB->Router form-POST path also
 * uses. No validate_instance (b-class) branch specific to
 * sw_mode/wlc_psta/wlc_dpsta/wlc_express was found beyond one narrow
 * #ifdef RTAC68U side effect (web.c:4902-4919); no dedicated cgi (c-class)
 * exists for any key in this set. So: were this page ever to grow a write
 * block, posting the (b) key-set directly through applyapp is a faithful
 * shortcut of the same server-side validation the wizard reaches — the
 * wizard is a UI convenience (site-survey pickers, SSID popups, confirm
 * dialogs), not a distinct server-side code path.
 *
 * NOT expressible this way, scoped out explicitly rather than approximated:
 *  - AiMesh Node: no key-set exists to post (d) — the wizard performs a
 *    restore/onboard flow outside validate_apply() entirely.
 *  - The chip-family-conditional branches inside Repeater/Media Bridge's
 *    sw_mode/wlc_psta/wlc_dpsta values (bcmwifi/qcawifi/rawifi/concurrep/
 *    amas) are resolved by the wizard's own runtime environment detection,
 *    not by any nvram flag this extension's capability collector exposes
 *    today — a future write implementation would need to either surface
 *    those flags or accept a narrower hardware-specific key set.
 *  - The wireless-scan / upstream-AP-credential step Repeater, Media
 *    Bridge, and WISP all route through before their final commit has no
 *    read/write equivalent on this page (site survey is a live scan, not
 *    an nvram-backed field) and is out of scope regardless of write status.
 *
 * -----------------------------------------------------------------------
 * SCOPE — what this page actually ships.
 * -----------------------------------------------------------------------
 * Per the operator's explicit instruction for this task: READ-ONLY. This
 * def has no `write` block at all — not merely a hard-excluded one — because
 * every candidate write here (b) is chip-family/runtime conditional in ways
 * this project's static page-def model cannot resolve safely, and because
 * (e) documents that even a correctly-built write is unsafe to submit
 * outside a supervised, physically-present session. `writeExclusion: 'wan'`
 * and `confidence.write: 'unverified-write'` are set anyway, matching this
 * project's convention of tagging a page by the risk category its subject
 * matter belongs to even when (as here) there is no write path yet to gate
 * — so diagnostics and any future reviewer see this page in the same
 * hard-excluded bucket as the rest of the WAN-role-redefinition surface
 * before a write block is ever added.
 */
import type { SettingsPageDef } from '../types';

/**
 * Replicates httpd/web.c:41773-41837 (ej_get_operation_mode), the
 * server-side helper the native UI's isSwMode() delegates to (state.js:
 * 258-277) and therefore the authoritative "what mode is the router in"
 * source — NOT the page's own separate client-side sw_mode remap, which
 * diverges from it (brief §2b). First matching rule wins, mirroring the
 * source's own if/else-if order.
 *
 * Deliberate divergence from the literal source: the firmware's "ew5" and
 * "hs" branches compare int nvram reads against char literals and can
 * never match on real hardware (web.c:41818-41827, a firmware bug, not
 * reproduced here — see header (c)). This function evaluates wlc_express
 * numerically instead, so Express Way 5GHz is reported correctly.
 */
function deriveOpMode(raw: Record<string, string>): Record<string, string> {
  const swMode = raw.sw_mode ?? '';
  const wlcPsta = raw.wlc_psta ?? '';
  const wlcExpress = raw.wlc_express ?? '';
  const mloRp = raw.mlo_rp ?? '';
  const mloMb = raw.mlo_mb ?? '';
  const wlcBand = raw.wlc_band ?? '';

  let token: string;
  let label: string;

  if (swMode === '2' && wlcPsta === '2' && mloRp === '1') {
    token = 'rp';
    label = 'Repeater';
  } else if (swMode === '3' && wlcPsta === '2' && mloMb === '1') {
    token = 'mb';
    label = 'Media Bridge';
  } else if (
    ((swMode === '2' && wlcPsta === '0') || (swMode === '3' && wlcPsta === '2')) &&
    wlcExpress === '0'
  ) {
    token = 'rp';
    label = 'Repeater';
  } else if (mloRp === '1') {
    token = 'rp';
    label = 'Repeater';
  } else if (
    (swMode === '3' && wlcPsta === '1' && wlcExpress === '0') ||
    (swMode === '3' && wlcPsta === '3' && wlcExpress === '0') ||
    (swMode === '2' && wlcPsta === '1' && wlcExpress === '0')
  ) {
    token = 'mb';
    label = 'Media Bridge';
  } else if (swMode === '3' && wlcPsta === '0') {
    token = 'ap';
    label = 'Access Point';
  } else if (swMode === '2' && wlcPsta === '0' && wlcExpress === '1') {
    token = 'ew2';
    label = 'Repeater — Express Way 2.4 GHz';
  } else if (swMode === '2' && wlcPsta === '0' && wlcExpress === '2') {
    token = 'ew5';
    label = 'Repeater — Express Way 5 GHz';
  } else if (swMode === '5') {
    // Overlaps the AiMeshMode UI radio's posted sw_mode value; the brief
    // could not confirm whether these ever collide on real hardware, and
    // separately found no write call site that ever sets sw_mode=5 in this
    // firmware generation (header (d)). Surfaced as-observed, not asserted.
    token = 'hs';
    label = 'Hotspot (sw_mode=5 — see AiMesh Node note below)';
  } else if (swMode === '1' && wlcBand !== '') {
    // __wisp_mode(): shared/shared.h:2167-2178, :2229-2240 — Router mode
    // plus a non-empty wlc_band. Must be checked before the plain-Router
    // fallthrough below, or a WISP router misreports as Router.
    token = 'wisp';
    label = 'WISP (Wireless ISP)';
  } else {
    token = 'rt';
    label = 'Router';
  }

  return {
    opmode_token: token,
    opmode_label: label,
  };
}

export const opModePages: SettingsPageDef[] = [
  {
    kind: 'settings',
    id: 'opmode',
    aspPage: 'Advanced_OperationMode_Content.asp',
    title: 'Operation Mode',
    navGroup: 'admin',
    navSub: 'access',
    navOrder: 64,
    confidence: { read: 'structural', write: 'unverified-write' },
    writeExclusion: 'wan',
    intro:
      'Read-only in this build. Switching operation mode redefines what plays ' +
      'the WAN role, can move the router to a DHCP-assigned address on a ' +
      'different subnet, and reboots the device — the native firmware itself ' +
      'has no address-migration redirect for that case and directs users to ' +
      'an external device-discovery tool instead. See the header comment in ' +
      'src/pages/defs/opmode.ts for the full mode -> nvram key matrix, source ' +
      'citations, and the reachability-risk writeup. AiMesh Node mode has no ' +
      'nvram write path at all in this firmware generation — selecting it ' +
      'natively triggers a factory-reset-class restore + re-onboard flow, not ' +
      'a settings change, and is not offered as an option here.',
    read: {
      nvram: ['sw_mode', 'wlc_psta', 'wlc_dpsta', 'wlc_express', 'wlc_band', 'mlo_rp', 'mlo_mb'],
      derive: (raw) => deriveOpMode(raw),
    },
    sections: [
      {
        title: 'Current mode',
        note:
          'Derived from sw_mode / wlc_psta / wlc_dpsta / wlc_express / wlc_band / ' +
          'mlo_rp / mlo_mb, replicating the router\'s own ej_get_operation_mode() ' +
          'decision table (the function the native UI itself trusts) — not a ' +
          'single-key lookup. WISP mode is Router mode (sw_mode=1) plus a ' +
          'non-empty wlc_band and would be misreported as plain Router by a ' +
          'naive sw_mode-only check.',
        fields: [
          { key: 'opmode_label', label: 'Detected operation mode', control: 'readonly' },
          {
            key: 'opmode_token',
            label: 'Raw mode token',
            hint: 'rt / ap / rp / mb / wisp / ew2 / ew5 / hs — matches the router\'s own get_operation_mode() vocabulary.',
            control: 'readonly',
          },
        ],
      },
      {
        title: 'Underlying nvram state',
        fields: [
          { key: 'sw_mode', label: 'sw_mode', control: 'readonly' },
          { key: 'wlc_psta', label: 'wlc_psta', control: 'readonly' },
          { key: 'wlc_dpsta', label: 'wlc_dpsta', control: 'readonly' },
          { key: 'wlc_express', label: 'wlc_express', control: 'readonly' },
          {
            key: 'wlc_band',
            label: 'wlc_band',
            hint: 'Non-empty alongside sw_mode=1 is what distinguishes WISP from plain Router mode.',
            control: 'readonly',
          },
          { key: 'mlo_rp', label: 'mlo_rp', control: 'readonly' },
          { key: 'mlo_mb', label: 'mlo_mb', control: 'readonly' },
        ],
      },
      {
        title: 'Why this page has no Apply button',
        note:
          'Every mode transition\'s exact nvram key combination is chip-family ' +
          'and runtime conditional in the native firmware (Broadcom vs. ' +
          'Qualcomm/Ralink wireless drivers, concurrent-repeater support, ' +
          'AiMesh state) in ways this extension\'s static page model cannot ' +
          'resolve safely from here. Separately, and regardless of that: a ' +
          'mode switch can leave the router unreachable at any address the ' +
          'operator or this extension knows, with no in-band recovery — the ' +
          'firmware\'s own UI strings admit this and point to an external MAC-' +
          'based discovery utility instead. This category (writeExclusion: ' +
          '\'wan\') is hard-blocked unconditionally by lib/write-policy.ts, ' +
          'independent of the read-only interlock. A live write here requires ' +
          'a dedicated supervised session with physical access to the device ' +
          'and a working discovery method ready before anything is submitted.',
        fields: [],
      },
    ],
  },
];
