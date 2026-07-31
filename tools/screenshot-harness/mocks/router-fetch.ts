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
  FIXTURE_NVRAM,
  FIXTURE_SYSINFO_SCALARS,
  FIXTURE_SYSINFO_TEXT,
  FIXTURE_UPTIME_RAW,
  FIXTURE_WCLIENTLIST,
  buildLeaseArrayPayload,
} from './fixtures';

const originalFetch = window.fetch.bind(window);

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
      out[m[1]] = FIXTURE_NVRAM[m[1]] ?? '';
    } else if ((m = /^nvram_char_to_ascii\(([^,]+),([^)]+)\)$/.exec(hook))) {
      out[m[1]] = FIXTURE_NVRAM[m[1]] ?? '';
    } else if (hook === 'uptime()') {
      out.uptime = FIXTURE_UPTIME_RAW;
    } else if (hook === 'get_wclientlist()') {
      out.get_wclientlist = FIXTURE_WCLIENTLIST;
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
      out[bare] = FIXTURE_NVRAM[bare] ?? '';
    }
  }
  return JSON.stringify(out);
}

function handleAppGet(url: URL): Response {
  const hookParam = url.searchParams.get('hook') ?? '';
  const hooks = hookParam.split(';').map((h) => h.trim()).filter(Boolean);
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
    pathname.endsWith('/start_apply.htm')
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

  // Write endpoints: never live in the harness (nothing real to write to),
  // but answered so read-only-off exploration doesn't hit a network error.
  if (url.pathname.endsWith('/applyapp.cgi')) return jsonResponse({ modify: '1' });
  if (url.pathname.endsWith('/start_apply.htm')) return textResponse('<html><body>OK</body></html>');

  return textResponse('', 404);
}

window.fetch = mockFetch as typeof window.fetch;
