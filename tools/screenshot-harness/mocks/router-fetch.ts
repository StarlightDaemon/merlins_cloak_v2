/**
 * Installs a `window.fetch` shim that answers the router endpoints
 * `src/lib/router-io.ts` calls (appGet.cgi, ajax_sysinfo.asp, and the write
 * endpoints) with FICTIONAL fixture data — see ./fixtures.ts.
 *
 * router-io.ts talks to the router exclusively through the global `fetch`
 * (same-origin XHR, per its own header comment), so this is the seam: no
 * file under src/ needs to change for the harness to work. Only requests to
 * the specific router paths below are intercepted; everything else (vite's
 * own dev-server/HMR requests, module fetches, etc.) is passed straight
 * through to the real fetch.
 *
 * Import this module for its side effect ONLY, before any router-io call
 * can happen — see content-entry.tsx.
 */
import {
  FIXTURE_AIMESH_NODES,
  FIXTURE_AIMESH_ONBOARDING,
  FIXTURE_AIMESH_STATUS,
  FIXTURE_DUALWAN_NVRAM,
  FIXTURE_HTTPD_CERT_INFO,
  FIXTURE_NT_CONTENT,
  FIXTURE_NVRAM,
  FIXTURE_RC_SUPPORT_CLASSIC,
  FIXTURE_RC_SUPPORT_DUALWAN,
  FIXTURE_SYSINFO_SCALARS,
  FIXTURE_SYSINFO_TEXT,
  FIXTURE_UPTIME_RAW,
  FIXTURE_USB_ACCOUNTS_RAW,
  FIXTURE_USB_BAD_PERMISSIONS_TEXT,
  FIXTURE_WCLIENTLIST,
  buildAccountPermissionsJsSource,
  buildAjaxOpenvpnServerText,
  buildLeaseArrayPayload,
  buildNtDbPayload,
  buildUsbInfoPayload,
} from './fixtures';

const originalFetch = window.fetch.bind(window);

/**
 * `?classic=1` (before the `#`, e.g. `content.html?classic=1#/dashboard` —
 * hash-fragment content is never part of `location.search`) switches the
 * rc_support fixture to FIXTURE_RC_SUPPORT_CLASSIC, dropping the `mtlancfg`
 * token so lib/capabilities.ts's hasFlag('mtlancfg_support') sees it unset
 * and the Dashboard renders its classic (non-SDN) fallback path. Every other
 * fixture value (sdn_rl, apg*, wl0/1/2_ssid, …) is left in place either way —
 * the classic path simply never reads the SDN-only keys, gated the same way
 * the real extension gates them (hasFlag(caps, 'mtlancfg_support')).
 */
const CLASSIC_FIXTURE = new URLSearchParams(window.location.search).has('classic');

/**
 * `?dualwan=1` (same before-the-`#` rule as `?classic=1`) switches the
 * rc_support fixture to FIXTURE_RC_SUPPORT_DUALWAN (adds the `dualwan`
 * token on top of the normal SDN flag set) and makes wan1_ (its various
 * nvram fields), wans_dualwan, wans_mode, wans_lb_ratio and wan{0,1}_primary
 * answer with
 * FIXTURE_DUALWAN_NVRAM's populated values instead of the (absent/empty)
 * defaults — see dashboard.tsx's dual-WAN active predicate and
 * fixtures.ts's FIXTURE_RC_SUPPORT_DUALWAN/FIXTURE_DUALWAN_NVRAM doc
 * comments. The single-WAN default is unaffected either way.
 */
const DUALWAN_FIXTURE = new URLSearchParams(window.location.search).has('dualwan');

/**
 * `?slowwrite=1` (same before-the-`#` rule as `?classic=1`) makes applyapp.cgi
 * writes land in the fixture nvram table only after an artificial delay, so a
 * write-capable settings page's Apply flow actually spends visible time in
 * write-guard.ts's poll-and-verify loop instead of matching on the very first
 * forced-fresh read — the only way to exercise (and screenshot) the
 * settle/verify progress UI (SettingsPage.tsx's onWriteProgress) without a
 * real router. Off by default so every other capture in this harness keeps
 * its existing instant-apply behavior.
 */
const SLOW_WRITE = new URLSearchParams(window.location.search).has('slowwrite');

/**
 * USB Share Accounts & Permissions (pages/defs/usb-accounts.tsx) fixture
 * variants — same before-the-`#` URL-switch convention as `?classic=1` /
 * `?dualwan=1` above. Independent of each other and of the switches above
 * (each gates a different hook this page reads), so they can in principle be
 * combined, though the harness only needs them one at a time to exercise
 * each degradation branch in isolation:
 *  - `?nodisk=1`: get_usb_info() answers with no mountPoint anywhere ->
 *    extractPools() returns [] -> the page's "No USB disk currently
 *    detected..." info banner.
 *  - `?noaccounts=1`: get_all_accounts() answers with an empty array -> the
 *    page's "No USB share accounts are configured on this router." empty
 *    state.
 *  - `?badaccounts=1`: get_permissions_of_account() answers with a response
 *    that has no recognizable `ident = {...}` assignment anywhere (see
 *    FIXTURE_USB_BAD_PERMISSIONS_TEXT in fixtures.ts) -> extractJsAssignments
 *    finds nothing for any candidate call -> fetchAccountPermissions()
 *    returns null -> the page's "Per-share permission data could not be
 *    read in a recognized format..." warn banner, degrading to the account
 *    list alone.
 */
const USB_NODISK_FIXTURE = new URLSearchParams(window.location.search).has('nodisk');
const USB_NOACCOUNTS_FIXTURE = new URLSearchParams(window.location.search).has('noaccounts');
const USB_BADACCOUNTS_FIXTURE = new URLSearchParams(window.location.search).has('badaccounts');
/** Chosen so a page's ~5s settle wait plus 2-3 poll intervals (800ms each,
 * see write-policy.ts POLL_INTERVAL_MS) elapse before the delayed value
 * becomes visible — long enough to see multiple 'poll-attempt' events land. */
const SLOW_WRITE_DELAY_MS = 7000;

/** Fields written by a `?slowwrite=1` applyapp.cgi POST, not yet "visible" to reads. */
const pendingWrites: Record<string, { value: string; availableAt: number }> = {};

/** Resolve one plain/ascii nvram fixture value, honoring the ?classic= / ?slowwrite= overrides. */
function nvramValue(key: string): string {
  if (key === 'rc_support') {
    if (CLASSIC_FIXTURE) return FIXTURE_RC_SUPPORT_CLASSIC;
    if (DUALWAN_FIXTURE) return FIXTURE_RC_SUPPORT_DUALWAN;
  }
  if (DUALWAN_FIXTURE && key in FIXTURE_DUALWAN_NVRAM) return FIXTURE_DUALWAN_NVRAM[key];
  const pending = pendingWrites[key];
  if (pending && Date.now() >= pending.availableAt) return pending.value;
  return FIXTURE_NVRAM[key] ?? '';
}

/**
 * `?slowwrite=1` only: read the submitted applyapp.cgi body and schedule its
 * fields to become visible to nvram reads after SLOW_WRITE_DELAY_MS, instead
 * of immediately. Non-nvram carrier fields (action_mode, rc_service, and
 * WOL's SystemCmd) are not meaningful nvram keys and are skipped.
 */
function scheduleSlowWrite(body: BodyInit | null | undefined): void {
  if (typeof body !== 'string') return;
  const params = new URLSearchParams(body);
  const availableAt = Date.now() + SLOW_WRITE_DELAY_MS;
  for (const [k, v] of params.entries()) {
    if (k === 'action_mode' || k === 'rc_service' || k === 'SystemCmd') continue;
    pendingWrites[k] = { value: v, availableAt };
  }
}

function textResponse(body: string, status = 200): Response {
  return new Response(body, { status, headers: { 'Content-Type': 'text/plain' } });
}

function jsonResponse(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } });
}

/**
 * Single-hook, non-JSON "array" feeds fetched via fetchHookRaw (see
 * src/lib/status-feeds.ts). Real firmware wraps these in
 * `{"<hook>":<js-assignment>}`; fetchHookRaw only cares about stripping the
 * outer `{"...":` / `}` envelope, not the exact hook name inside it.
 */
const RAW_HOOK_PAYLOADS: Record<string, () => string> = {
  'get_leases_array()': buildLeaseArrayPayload,
  // get_nt_db() is fetched by notification.tsx as a single raw hook (its own
  // fetchNtDb(), not through appGet()'s batched helper) and JSON.parse()d
  // directly — a plain JSON array payload (not a JS-assignment string like
  // buildLeaseArrayPayload) is exactly what it expects to find wrapped in
  // the `{"get_nt_db": ...}` envelope.
  'get_nt_db()': buildNtDbPayload,
  // Unfixtured array hooks (routes, connections, port forwards, upnp, ipv6,
  // wl_status) fall through to the generic JSON-mode handler below, which
  // answers with an empty envelope — the reading pages already treat "no
  // rows parsed" as an empty (not broken) table.
};

function buildRawEnvelope(hook: string): string {
  const bare = hook.replace(/\(.*\)$/, '');
  const payload = RAW_HOOK_PAYLOADS[hook]?.() ?? '';
  return `{\n"${bare}":${payload}\n}\n`;
}

function buildJsonEnvelope(hooks: string[]): string {
  const out: Record<string, unknown> = {};
  for (const hook of hooks) {
    let m: RegExpExecArray | null;
    if ((m = /^nvram_get\(([^)]+)\)$/.exec(hook))) {
      out[m[1]] = nvramValue(m[1]);
    } else if ((m = /^nvram_char_to_ascii\(([^,]+),([^)]+)\)$/.exec(hook))) {
      out[m[1]] = nvramValue(m[1]);
    } else if (hook === 'uptime()') {
      out.uptime = FIXTURE_UPTIME_RAW;
    } else if (hook === 'get_wclientlist()') {
      out.get_wclientlist = FIXTURE_WCLIENTLIST;
    } else if (hook === 'get_cfg_clientlist()') {
      // AiMesh Node Management (pages/defs/aimesh.tsx) — array of node
      // records, index 0 is always the local/CAP router.
      out.get_cfg_clientlist = FIXTURE_AIMESH_NODES;
    } else if (hook === 'get_onboardinglist()') {
      out.get_onboardinglist = FIXTURE_AIMESH_ONBOARDING;
    } else if (hook === 'get_onboardingstatus()') {
      out.get_onboardingstatus = FIXTURE_AIMESH_STATUS;
    } else if (hook === 'httpd_cert_info()') {
      // Router HTTPS Certificate (pages/defs/certificates.tsx RouterCertPage)
      // — parsed metadata only, never raw PEM (see fixtures.ts's comment).
      out.httpd_cert_info = FIXTURE_HTTPD_CERT_INFO;
    } else if (hook === 'get_all_accounts()') {
      // USB Share Accounts & Permissions (pages/defs/usb-accounts.tsx) —
      // plain JSON array of (possibly ascii-encoded) account name strings.
      // `?noaccounts=1` answers an empty list (see USB_NOACCOUNTS_FIXTURE).
      out.get_all_accounts = USB_NOACCOUNTS_FIXTURE ? [] : FIXTURE_USB_ACCOUNTS_RAW;
    } else if (hook === 'get_usb_info()') {
      // Same page — used only for pool/mount-point discovery. `?nodisk=1`
      // answers with no mountPoint anywhere (see USB_NODISK_FIXTURE).
      out.get_usb_info = USB_NODISK_FIXTURE ? {} : buildUsbInfoPayload();
    } else if ((m = /^sysinfo\("([^"]+)"\)$/.exec(hook))) {
      // Real firmware keys parenthesized sysinfo() scalar hooks as
      // "sysinfo-<arg>" (see pages/defs/nettools.tsx: s['sysinfo-cpu.model']
      // etc.) — fetchScalarHooks (lib/status-feeds.ts) text-scans the
      // response for that exact key shape, so the fixture must reproduce it
      // rather than the generic bare-hook-name fallback below.
      out[`sysinfo-${m[1]}`] = FIXTURE_SYSINFO_SCALARS[m[1]] ?? '';
    } else {
      // Generic fallback for any hook this fixture set doesn't model
      // specifically: answer with the plain nvram value if we have one,
      // otherwise an empty string. Never throws — unfixtured pages render
      // with blank fields instead of crashing the harness.
      const bare = hook.replace(/\(.*\)$/, '');
      out[bare] = nvramValue(bare);
    }
  }
  return JSON.stringify(out);
}

function handleAppGet(url: URL): Response {
  const hookParam = url.searchParams.get('hook') ?? '';
  const hooks = hookParam.split(';').map((h) => h.trim()).filter(Boolean);
  if (hooks.length === 1 && /^get_permissions_of_account\(/.test(hooks[0])) {
    // usb-accounts.tsx fetches this one hook as raw text directly
    // (fetchRouterText), never through appGet()'s JSON-batching path — the
    // real firmware emits raw JS source here (see fixtures.ts's
    // buildAccountPermissionsJsSource header comment), so unlike every hook
    // below this response must NOT be JSON-wrapped at all, not even via the
    // RAW_HOOK_PAYLOADS `{"hook":...}` envelope (that's still JSON; this
    // genuinely isn't). `?badaccounts=1` swaps in an unrecognized response
    // instead — see USB_BADACCOUNTS_FIXTURE / FIXTURE_USB_BAD_PERMISSIONS_TEXT.
    return textResponse(USB_BADACCOUNTS_FIXTURE ? FIXTURE_USB_BAD_PERMISSIONS_TEXT : buildAccountPermissionsJsSource());
  }
  if (hooks.length === 1 && hooks[0] in RAW_HOOK_PAYLOADS) {
    return textResponse(buildRawEnvelope(hooks[0]));
  }
  return textResponse(buildJsonEnvelope(hooks));
}

/** Router paths this shim recognizes; anything else passes through untouched. */
function isRouterPath(pathname: string): boolean {
  return (
    pathname.endsWith('/appGet.cgi') ||
    pathname.endsWith('/ajax_sysinfo.asp') ||
    pathname.endsWith('/applyapp.cgi') ||
    pathname.endsWith('/start_apply.htm') ||
    // Notification Center's static display-template file (plain same-origin
    // GET, not an appGet/ej hook — see notification.tsx's fetchNtContent()).
    pathname.endsWith('/nt_content.json') ||
    // VPN Certificates & Keys' OpenVPN cert/key presence side-channel (plain
    // same-origin GET — see certificates.tsx's fetchOpenvpnCrtPresence()).
    pathname.endsWith('/ajax_openvpn_server.asp')
  );
}

async function mockFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const rawUrl = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  let url: URL;
  try {
    url = new URL(rawUrl, window.location.href);
  } catch {
    return originalFetch(input, init);
  }

  if (!isRouterPath(url.pathname)) {
    return originalFetch(input, init);
  }

  if (url.pathname.endsWith('/appGet.cgi')) return handleAppGet(url);
  if (url.pathname.endsWith('/ajax_sysinfo.asp')) return textResponse(FIXTURE_SYSINFO_TEXT);
  if (url.pathname.endsWith('/nt_content.json')) return jsonResponse(FIXTURE_NT_CONTENT);
  if (url.pathname.endsWith('/ajax_openvpn_server.asp')) return textResponse(buildAjaxOpenvpnServerText());

  // Write endpoints: never live in the harness (nothing real to write to),
  // but answered so read-only-off exploration doesn't hit a network error.
  if (url.pathname.endsWith('/applyapp.cgi')) {
    if (SLOW_WRITE) scheduleSlowWrite(init?.body);
    return jsonResponse({ modify: '1' });
  }
  if (url.pathname.endsWith('/start_apply.htm')) {
    if (SLOW_WRITE) scheduleSlowWrite(init?.body);
    return textResponse('<html><body>OK</body></html>');
  }

  return textResponse('', 404);
}

window.fetch = mockFetch as typeof window.fetch;
