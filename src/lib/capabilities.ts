/**
 * Runtime capability detection — the single source of truth for which UI
 * sections render. Nothing in the page catalog may assume a feature exists
 * without a live check through this layer.
 *
 * Primary source: the `*_support` globals the native page's own state.js has
 * already computed in the MAIN world (state.js parses nvram `rc_support` plus
 * per-flag nvram reads; reimplementing it would drift). We read them by
 * injecting a collector <script> into the page and receiving a postMessage.
 * The operator's RT-BE92U exposes 228 such globals live.
 *
 * Fallback (collector blocked/timed out, or page without state.js): parse the
 * raw `rc_support` nvram string into presence-boolean flags. Numeric flag
 * values are unavailable on this path; checks should treat flags as truthy.
 *
 * Two names that appear in older static reports — `gu_support` and
 * `asus_support` — are NOT real live globals and must never be referenced.
 */
import { fetchRouterText, nvramGet } from './router-io';
import { log } from './log';

export type FlagValue = number | boolean | string;

export type Generation = 'asuswrt-50-wifi7' | 'asuswrt-40-wifi6' | 'unknown';

export interface RouterIdentity {
  productId: string;
  firmwareVersion: string; // firmver, e.g. 3.0.0.6
  buildNo: string;
  extendNo: string;
  /** Full display string, e.g. 3.0.0.6.102_7_2 */
  displayVersion: string;
  generation: Generation;
  branch: 'merlin' | 'stock' | 'unknown';
  lanIp: string;
}

export interface Capabilities {
  flags: Record<string, FlagValue>;
  rcSupport: Set<string>;
  identity: RouterIdentity;
  flagSource: 'main-world' | 'rc_support-fallback';
  collectedAt: number;
}

/** Truthy feature check. `flag('mtlancfg_support')` etc. */
export function hasFlag(caps: Capabilities, name: string): boolean {
  const v = caps.flags[name];
  if (v === undefined) {
    // fallback: rc_support token without the _support suffix
    const token = name.replace(/_support$/, '');
    return caps.rcSupport.has(token);
  }
  if (typeof v === 'string') return v !== '' && v !== '0';
  return Boolean(v);
}

export function flagValue(caps: Capabilities, name: string): FlagValue | undefined {
  return caps.flags[name];
}

// ---------------------------------------------------------------------------

const COLLECTOR_TIMEOUT_MS = 4000;

/**
 * Inject a MAIN-world collector that reports every window global ending in
 * `_support`. Values are simplified to number|boolean|string ('{}' for object
 * flags, matching how the live probe recorded them).
 */
function collectMainWorldFlags(): Promise<Record<string, FlagValue> | null> {
  return new Promise((resolve) => {
    let done = false;
    const nonce = `mc2-${Math.random().toString(36).slice(2)}`;
    const finish = (v: Record<string, FlagValue> | null) => {
      if (!done) {
        done = true;
        window.removeEventListener('message', onMessage);
        resolve(v);
      }
    };
    const onMessage = (ev: MessageEvent) => {
      const d = ev.data as { __mc2Nonce?: string; flags?: Record<string, FlagValue>; error?: string } | null;
      if (!d || d.__mc2Nonce !== nonce) return;
      if (d.error) {
        log.warn('main-world flag collector reported error', d.error);
        finish(null);
        return;
      }
      finish(d.flags ?? null);
    };
    window.addEventListener('message', onMessage);

    const script = document.createElement('script');
    script.textContent = `(function(){
      try {
        var flags = {};
        var names = Object.getOwnPropertyNames(window);
        for (var i = 0; i < names.length; i++) {
          var k = names[i];
          if (k.length > 8 && k.indexOf('_support', k.length - 8) !== -1) {
            try {
              var v = window[k];
              var t = typeof v;
              if (t === 'number' || t === 'boolean' || t === 'string') flags[k] = v;
              else if (v && t === 'object') flags[k] = '{}';
            } catch (e) { /* skip unreadable global */ }
          }
        }
        window.postMessage({ __mc2Nonce: ${JSON.stringify(nonce)}, flags: flags }, '*');
      } catch (e) {
        window.postMessage({ __mc2Nonce: ${JSON.stringify(nonce)}, error: String(e) }, '*');
      }
    })();`;
    (document.head || document.documentElement).appendChild(script);
    script.remove();
    setTimeout(() => finish(null), COLLECTOR_TIMEOUT_MS);
  });
}

function classifyGeneration(firmver: string): Generation {
  // Established convention: 3.0.0.6.x → ASUSWRT 5.0 / Wi-Fi 7 hardware;
  // 3.0.0.4.386/388.x → ASUSWRT 4.0 / Wi-Fi 6 and 6E hardware.
  if (firmver.startsWith('3.0.0.6')) return 'asuswrt-50-wifi7';
  if (firmver.startsWith('3.0.0.4')) return 'asuswrt-40-wifi6';
  return 'unknown';
}

/**
 * Branch detection is a presence question (Merlin's httpd routing is a strict
 * superset of stock's): probe a Merlin-only endpoint. ajax_sysinfo.asp is the
 * cheapest stable marker — present on every Merlin build in scope, absent
 * from stock.
 */
async function detectBranch(): Promise<'merlin' | 'stock' | 'unknown'> {
  try {
    await fetchRouterText('/ajax_sysinfo.asp');
    return 'merlin';
  } catch (e) {
    if (e instanceof Error && e.name === 'RouterIOError' && /404/.test(e.message)) return 'stock';
    return 'unknown';
  }
}

export async function collectCapabilities(): Promise<Capabilities> {
  const [idVals, branch, mainWorldFlags] = await Promise.all([
    nvramGet(['productid', 'firmver', 'buildno', 'extendno', 'rc_support', 'lan_ipaddr', 'odmpid']),
    detectBranch(),
    collectMainWorldFlags(),
  ]);

  const rcSupport = new Set(
    (idVals.rc_support || '')
      .split(/\s+/)
      .map((t) => t.trim())
      .filter(Boolean),
  );

  let flags: Record<string, FlagValue>;
  let flagSource: Capabilities['flagSource'];
  if (mainWorldFlags && Object.keys(mainWorldFlags).length > 0) {
    flags = mainWorldFlags;
    flagSource = 'main-world';
  } else {
    flags = {};
    for (const token of rcSupport) flags[`${token}_support`] = true;
    flagSource = 'rc_support-fallback';
    log.warn('capability collection fell back to rc_support parsing');
  }

  const firmver = idVals.firmver || '';
  const identity: RouterIdentity = {
    productId: idVals.odmpid || idVals.productid || 'unknown',
    firmwareVersion: firmver,
    buildNo: idVals.buildno || '',
    extendNo: idVals.extendno || '',
    displayVersion: [firmver, idVals.buildno, idVals.extendno].filter(Boolean).join('.'),
    generation: classifyGeneration(firmver),
    branch,
    lanIp: idVals.lan_ipaddr || '',
  };

  const caps: Capabilities = {
    flags,
    rcSupport,
    identity,
    flagSource,
    collectedAt: Date.now(),
  };
  log.info(
    `capabilities: ${identity.productId} ${identity.displayVersion} (${identity.generation}, ${identity.branch}), ` +
      `${Object.keys(flags).length} flags via ${flagSource}`,
  );
  return caps;
}
