/**
 * USB share accounts & permissions — READ-ONLY viewer.
 *
 * Companion to ./usb.ts, which documents (and deliberately skips) the write
 * side of this feature. This file adds the read-only half: per the research
 * brief (scratchpad/research/04-usb-trio.md §A), the account list and the
 * per-account/per-folder/per-protocol permission grants ARE readable even
 * though the six /aidisk/*.asp CRUD endpoints that create/modify them are
 * out of scope for writes (see "WHY NO WRITE PATH" below).
 *
 * Hooks used (httpd/web.c, Merlin 3006.102.7_2 GPL drop, RAW/merlin):
 *
 *  - get_all_accounts — ej_get_all_accounts, web.c:28746-28805, registered
 *      "get_all_accounts" (web.c:42005 table). Returns a JSON array of
 *      account name strings (or just the router admin username as a
 *      single-element array if RTCONFIG_USB is undefined entirely,
 *      web.c:28800-28802). Names are emitted through the same "ASCII-
 *      encoded" convention the brief flags for the `account` POST param
 *      elsewhere in this subsystem (char_to_ascii family, decoded server-
 *      side via ascii_to_char_safe, web.c:29362 et al.) — decoded locally
 *      here (decodeAsciiEncodedName below) with the same percent-unescape
 *      this project's nvramCharToAscii (../../lib/router-io.ts) already
 *      uses for that firmware convention, since get_all_accounts is a
 *      plain ej hook value, not an nvram_char_to_ascii read, so it cannot
 *      be routed through that helper directly. Falls back to the raw
 *      string unchanged if it isn't percent-escaped at all (the common
 *      case for plain account names — the task's own example fixtures like
 *      'demo-user' round-trip as a no-op).
 *
 *  - get_permissions_of_account — ej_get_permissions_of_account,
 *      web.c:29290, built by draw_permissions_of_pms() walking
 *      read_disk_data() x every known account. THE BRIEF WARNS this emits
 *      embedded JS source — a `function get_account_permissions_in_pool
 *      (account, pool) {...}` definition plus whatever data table
 *      draw_permissions_of_pms() wrote ahead of it — not a JSON value
 *      appGet.cgi can wrap cleanly. This file therefore does NOT call it
 *      through appGet() (which JSON.parses the body and would throw on a
 *      non-JSON reply); it fetches the hook URL as raw text
 *      (fetchRouterText, ../../lib/router-io.ts) and parses defensively,
 *      following the same "ej writes JS source, not JSON" precedent as
 *      ../../lib/trafmon.ts (reusing its exported jsLiteralToJson
 *      normalizer). The exact emitted shape is UNCONFIRMED — no live
 *      capture of this endpoint exists, and the brief could not determine
 *      it from source either. extractJsAssignments() scans the body for
 *      every top-level `ident = {...}` / `ident = [...]` assignment,
 *      JSON-parses each candidate independently, and findNodeByKey() /
 *      collectShareLeaves() walk each parsed tree looking for a node keyed
 *      by a known (raw, still-encoded) account name whose descendants look
 *      like {cifs|ftp|dms|webdav: 0-3} permission leaves, in whatever
 *      nesting order (account->pool->folder->protocol,
 *      account->folder->protocol, or a flat array of
 *      {account,pool,folder,protocol,permission} records) the actual
 *      firmware happens to use. If nothing recognizable is found for any
 *      account, this degrades to showing the account list alone with an
 *      inline note — it never throws past fetchAccountPermissions()'s own
 *      try/catch boundary.
 *
 *  - get_usb_info — ej_get_usb_info, web.c:11270, registered "get_usb_info"
 *      (brief §B; also the source of Time Machine's isTM/hasTM matching in
 *      usb.ts's timemachinePage comment). Used here only to detect whether
 *      any USB disk is actually mounted, for the "no USB disk attached"
 *      empty state, and to label share rows with their pool (mount point)
 *      when the permission parse above can supply one. Full disk/partition
 *      browsing is out of scope, same as timemachinePage in usb.ts — parsed
 *      defensively via extractPools() (generic recursive scan for any
 *      object carrying a mountPoint/mount_point string), never throws.
 *
 * Permission integer semantics (brief §A, from www/disk_functions.js:
 * 519-593 showPermissionRadio, cross-checked against the permission-title
 * legend at Advanced_AiDisk_samba.asp:299-317):
 *
 *   value | cifs (Samba) / webdav        | ftp
 *   ------|-------------------------------|--------------------
 *     0   | No access (Deny)              | No access (Deny)
 *     1   | Read only                     | Read only
 *     2   | legacy alias, renders as the  | Write only
 *         | R/W radio checked for cifs/   |
 *         | webdav                        |
 *     3   | Read/Write                    | Read/Write
 *
 * The integer meaning genuinely differs by protocol (2 means "write only"
 * for ftp but is a legacy Read/Write alias for cifs/webdav) — every
 * permission value below is labeled per-protocol (permissionLabel()) rather
 * than shown as a bare number.
 *
 * WHY NO WRITE PATH: the six /aidisk/*.asp account endpoints
 * (create_account.asp, delete_account.asp, modify_account.asp,
 * initial_account.asp, set_account_permission.asp,
 * set_account_all_folder_permission.asp — handlers web.c:29847, 29890,
 * 29929, 29761, 29347, 29435 respectively) are dedicated CGI POSTs entirely
 * outside action_mode=apply / applyapp.cgi / validate_apply(). This
 * project's WriteEndpoint vocabulary (../../lib/router-io.ts) only knows
 * 'applyapp' and 'start_apply' — building these six endpoints would require
 * extending that shared write chokepoint (out of bounds for a page-def-only
 * change) plus its own guard/verify story, since there is no nvram key to
 * forced-fresh-read back for confirmation the way every other write in this
 * project is verified. That is deliberately left for a separate, reviewed
 * pass — not attempted here. This page is therefore intentionally a
 * CustomPageDef with no `write` concept at all (kind: 'custom' pages carry
 * no WriteDef in the page-def type), and confidence.write is omitted rather
 * than set, because no write path exists to have a confidence tier.
 *
 * acc_list / acc_num ARE literal defaults.c entries (shared/defaults.c:
 * 3402-3406) and so are technically reachable through the generic applyapp
 * path — but MUST NEVER be posted directly. acc_list is CKN_ENC_SVR
 * (server-side-encrypted at rest), and its true backing store is
 * confirmed-partly the opaque on-disk `.__*` files living on the USB
 * filesystem itself (ej_initial_account's cleanup path does `rm -f
 * <mount>/.__*`, web.c:29761-29794), written by add_account/mod_account/
 * del_account/set_permission — none of which have source anywhere in this
 * GPL drop. A raw nvram write to acc_list/acc_num would very likely desync
 * nvram from that on-disk state with no way to detect or roll it back
 * purely by re-reading nvram. This file only ever reads through the ej
 * hooks documented above; it never reads or writes nvram acc_list/acc_num
 * directly.
 */
import { useCallback, useEffect, useState } from 'react';
import { appGet, fetchRouterText } from '../../lib/router-io';
import { jsLiteralToJson } from '../../lib/trafmon';
import type { PageDef, PageProps } from '../types';
import { Badge, Banner, Button, Card, EmptyState, Loading } from '../../ui/components';

// ---------------------------------------------------------------------------
// Permission decoding
// ---------------------------------------------------------------------------

const KNOWN_PROTOCOLS = ['cifs', 'ftp', 'dms', 'webdav'] as const;
type ProtocolKey = (typeof KNOWN_PROTOCOLS)[number];

const PROTOCOL_LABEL: Record<ProtocolKey, string> = {
  cifs: 'Samba (SMB)',
  ftp: 'FTP',
  dms: 'Media server',
  webdav: 'WebDAV',
};

/** See the file header's permission-semantics table — cifs/webdav and ftp diverge at value 2. */
function permissionLabel(protocol: ProtocolKey, value: number): string {
  if (protocol === 'ftp') {
    switch (value) {
      case 0:
        return 'No access';
      case 1:
        return 'Read only';
      case 2:
        return 'Write only';
      case 3:
        return 'Read/Write';
      default:
        return `Unrecognized value (${value})`;
    }
  }
  switch (value) {
    case 0:
      return 'No access';
    case 1:
      return 'Read only';
    case 2:
      return 'Read/Write (legacy)';
    case 3:
      return 'Read/Write';
    default:
      return `Unrecognized value (${value})`;
  }
}

function permissionTone(value: number): 'ok' | 'warn' | 'err' | 'info' {
  if (value === 0) return 'err';
  if (value === 1) return 'warn';
  if (value === 2 || value === 3) return 'ok';
  return 'info';
}

/**
 * get_all_accounts returns names through the firmware's char_to_ascii
 * "ASCII-encoding" convention (see file header). This project's only
 * confirmed decoder for that convention is nvramCharToAscii's percent-style
 * unescape (../../lib/router-io.ts) — mirrored locally since this value
 * comes from an ej hook, not an nvram_char_to_ascii read. Defensive: any
 * string that isn't percent-escaped round-trips unchanged.
 */
function decodeAsciiEncodedName(raw: string): string {
  try {
    return decodeURIComponent(raw.replace(/\+/g, '%20'));
  } catch {
    return raw;
  }
}

// ---------------------------------------------------------------------------
// Defensive JS-source parsing for get_permissions_of_account
// (see file header — shape is unconfirmed; this must never throw upward)
// ---------------------------------------------------------------------------

/** Scan `text` for every `ident = {...}` / `ident = [...]` assignment and JSON-parse each candidate. */
function extractJsAssignments(text: string): unknown[] {
  const out: unknown[] = [];
  const re = /[A-Za-z_$][\w$]*\s*=\s*([[{])/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const openCh = m[1];
    const closeCh = openCh === '[' ? ']' : '}';
    const start = m.index + m[0].length - 1;
    let depth = 0;
    let end = -1;
    for (let i = start; i < text.length; i++) {
      if (text[i] === openCh) depth++;
      else if (text[i] === closeCh) {
        depth--;
        if (depth === 0) {
          end = i;
          break;
        }
      }
    }
    if (end === -1) {
      re.lastIndex = start + 1;
      continue;
    }
    const body = text.slice(start, end + 1);
    try {
      out.push(JSON.parse(jsLiteralToJson(body)));
    } catch {
      // Not a parseable literal — skip this candidate, keep scanning.
    }
    re.lastIndex = end + 1;
  }
  return out;
}

/** Depth-bounded search for a key matching `key` (case-insensitive) anywhere in `obj`. */
function findNodeByKey(obj: unknown, key: string, depth = 0): unknown {
  if (depth > 6 || obj === null || typeof obj !== 'object') return undefined;
  if (!Array.isArray(obj)) {
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      if (k.toLowerCase() === key.toLowerCase()) return v;
    }
  }
  const values: unknown[] = Array.isArray(obj) ? obj : Object.values(obj as Record<string, unknown>);
  for (const v of values) {
    const found = findNodeByKey(v, key, depth + 1);
    if (found !== undefined) return found;
  }
  return undefined;
}

interface ShareRow {
  pool?: string;
  folder: string;
  perms: Partial<Record<ProtocolKey, number>>;
}

function isProtocolKey(k: string): k is ProtocolKey {
  return (KNOWN_PROTOCOLS as readonly string[]).includes(k.toLowerCase());
}

/**
 * Depth-bounded tree walk collecting permission "leaves" — objects whose
 * keys are entirely protocol names with numeric-looking values — under
 * whatever nesting order (…/pool/folder/protocol or …/folder/protocol) the
 * real response happens to use. Also recognizes a flat array-of-records
 * shape ({folder, pool, protocol, permission}) as an alternative encoding.
 */
function collectShareLeaves(node: unknown, path: string[], out: ShareRow[], depth = 0): void {
  if (depth > 6 || node === null || typeof node !== 'object') return;

  if (Array.isArray(node)) {
    for (const item of node) {
      if (item && typeof item === 'object' && !Array.isArray(item)) {
        const rec = item as Record<string, unknown>;
        const proto = typeof rec.protocol === 'string' ? rec.protocol.toLowerCase() : undefined;
        const folder = typeof rec.folder === 'string' ? rec.folder : undefined;
        const permRaw = rec.permission ?? rec.right ?? rec.perm;
        if (folder && proto && isProtocolKey(proto) && permRaw !== undefined) {
          const val = Number(permRaw);
          if (Number.isFinite(val)) {
            out.push({
              pool: typeof rec.pool === 'string' ? rec.pool : path[path.length - 1],
              folder,
              perms: { [proto]: val } as Partial<Record<ProtocolKey, number>>,
            });
            continue;
          }
        }
      }
      collectShareLeaves(item, path, out, depth + 1);
    }
    return;
  }

  const entries = Object.entries(node as Record<string, unknown>);
  if (entries.length === 0) return;
  const isLeaf = entries.every(([k, v]) => isProtocolKey(k) && (typeof v === 'number' || typeof v === 'string'));
  if (isLeaf) {
    const perms: Partial<Record<ProtocolKey, number>> = {};
    for (const [k, v] of entries) {
      const num = Number(v);
      if (Number.isFinite(num)) perms[k.toLowerCase() as ProtocolKey] = num;
    }
    if (Object.keys(perms).length > 0) {
      out.push({
        pool: path.length > 1 ? path[path.length - 2] : undefined,
        folder: path[path.length - 1] ?? '(share)',
        perms,
      });
    }
    return;
  }
  for (const [k, v] of entries) {
    collectShareLeaves(v, [...path, k], out, depth + 1);
  }
}

/**
 * Best-effort fetch + parse of per-account share permissions. Tries the
 * no-argument hook call first (matching the other single-shot ej hooks in
 * this subsystem, e.g. get_all_accounts), then a per-pool call for each
 * known mount point (speculative — the brief only confirms the emitted JS
 * function's signature is `get_account_permissions_in_pool(account, pool)`,
 * not the ej hook's own server-side argument convention). Returns null
 * (never throws) when no candidate yields a recognizable structure for any
 * known account — callers must treat null as "degrade to account list only".
 */
async function fetchAccountPermissions(rawAccounts: string[], pools: string[]): Promise<Map<string, ShareRow[]> | null> {
  const candidates = ['get_permissions_of_account()', ...pools.map((p) => `get_permissions_of_account(${p})`)];
  for (const hookCall of candidates) {
    try {
      const text = await fetchRouterText(`/appGet.cgi?hook=${encodeURIComponent(hookCall)}`);
      const parsed = extractJsAssignments(text);
      if (parsed.length === 0) continue;
      const result = new Map<string, ShareRow[]>();
      for (const account of rawAccounts) {
        for (const obj of parsed) {
          const node = findNodeByKey(obj, account);
          if (node === undefined) continue;
          const rows: ShareRow[] = [];
          collectShareLeaves(node, [], rows);
          if (rows.length > 0) {
            const existing = result.get(account) ?? [];
            result.set(account, existing.concat(rows));
            break;
          }
        }
      }
      if (result.size > 0) return result;
    } catch {
      // Try the next candidate hook call.
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// USB disk / pool enumeration (get_usb_info) — used only for the "no disk
// attached" empty state and to label share rows with a pool when available.
// ---------------------------------------------------------------------------

interface PoolInfo {
  mountPoint: string;
  label?: string;
}

function extractPools(raw: unknown, depth = 0, out: PoolInfo[] = []): PoolInfo[] {
  if (depth > 6 || raw === null || typeof raw !== 'object') return out;
  if (Array.isArray(raw)) {
    for (const item of raw) extractPools(item, depth + 1, out);
    return out;
  }
  const rec = raw as Record<string, unknown>;
  const mp = rec.mountPoint ?? rec.mount_point;
  if (typeof mp === 'string' && mp) {
    const label = typeof rec.partName === 'string' ? rec.partName : typeof rec.label === 'string' ? rec.label : undefined;
    out.push({ mountPoint: mp, label });
  }
  for (const v of Object.values(rec)) {
    if (v && typeof v === 'object') extractPools(v, depth + 1, out);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface AccountRow {
  raw: string;
  name: string;
  shares: ShareRow[];
}

interface FlatRow {
  account: string;
  pool: string;
  folder: string;
  perms: Partial<Record<ProtocolKey, number>>;
}

function UsbAccountsPage(_props: PageProps) {
  const [accounts, setAccounts] = useState<AccountRow[] | null>(null);
  const [pools, setPools] = useState<PoolInfo[] | null>(null);
  const [permissionsUnavailable, setPermissionsUnavailable] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const accRes = await appGet(['get_all_accounts()']);
      const rawList = Array.isArray(accRes.get_all_accounts) ? (accRes.get_all_accounts as unknown[]).map(String) : [];

      let poolList: PoolInfo[] = [];
      try {
        const usbRes = await appGet(['get_usb_info()']);
        poolList = extractPools(usbRes.get_usb_info);
      } catch {
        poolList = [];
      }
      setPools(poolList);

      let permMap: Map<string, ShareRow[]> | null = null;
      if (rawList.length > 0) {
        try {
          permMap = await fetchAccountPermissions(
            rawList,
            poolList.map((p) => p.mountPoint),
          );
        } catch {
          permMap = null;
        }
      }
      setPermissionsUnavailable(permMap === null);

      const rows: AccountRow[] = rawList.map((raw) => ({
        raw,
        name: decodeAsciiEncodedName(raw),
        shares: permMap?.get(raw) ?? [],
      }));
      setAccounts(rows);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const noDisk = pools !== null && pools.length === 0;
  const flatRows: FlatRow[] = [];
  if (accounts) {
    for (const acc of accounts) {
      if (acc.shares.length === 0) {
        flatRows.push({ account: acc.name, pool: '—', folder: '—', perms: {} });
      } else {
        for (const s of acc.shares) {
          flatRows.push({ account: acc.name, pool: s.pool ?? '—', folder: s.folder, perms: s.perms });
        }
      }
    }
  }

  return (
    <div>
      <h1 className="mc-page-title">USB Share Accounts &amp; Permissions</h1>
      <p className="mc-page-subtitle">Read-only — account/pool/folder/protocol share grants</p>
      {error && <Banner tone="err">Failed to read account data: {error}</Banner>}
      <div className="mc-feedbar">
        <Button small onClick={() => void load()}>
          Refresh
        </Button>
      </div>
      {!accounts && !error ? (
        <Loading />
      ) : accounts ? (
        <>
          {noDisk && (
            <Banner tone="info">
              No USB disk currently detected as mounted. Account records may still exist from a previous disk; no
              per-share data can be confirmed reachable right now.
            </Banner>
          )}
          {permissionsUnavailable && accounts.length > 0 && (
            <Banner tone="warn">
              Per-share permission data could not be read in a recognized format from this router (the underlying
              hook emits raw JS source rather than JSON, and its exact shape is unconfirmed — see the source
              comment). Showing the account list only.
            </Banner>
          )}
          {accounts.length === 0 ? (
            <EmptyState>No USB share accounts are configured on this router.</EmptyState>
          ) : (
            <Card title={`Accounts (${accounts.length})`}>
              <table className="mc-table mc-table--mono">
                <thead>
                  <tr>
                    <th>Account</th>
                    <th>Pool</th>
                    <th>Folder</th>
                    {KNOWN_PROTOCOLS.map((p) => (
                      <th key={p}>{PROTOCOL_LABEL[p]}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {flatRows.map((r, i) => (
                    <tr key={`${r.account}-${r.pool}-${r.folder}-${i}`}>
                      <td>{r.account}</td>
                      <td>{r.pool}</td>
                      <td>{r.folder}</td>
                      {KNOWN_PROTOCOLS.map((p) => {
                        const v = r.perms[p];
                        return (
                          <td key={p}>
                            {v === undefined ? (
                              <span style={{ opacity: 0.5 }}>—</span>
                            ) : (
                              <Badge tone={permissionTone(v)}>{permissionLabel(p, v)}</Badge>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mc-card__note">
                Permission value 2 means different things per protocol (write-only for FTP, a legacy Read/Write
                alias for Samba/WebDAV) — see the source file header for the full table. This page never writes;
                account creation, deletion, and permission changes are managed on the router&apos;s own Network
                Place / FTP settings page.
              </p>
            </Card>
          )}
        </>
      ) : null}
    </div>
  );
}

export const usbAccountPages: PageDef[] = [
  {
    kind: 'custom',
    id: 'usb-accounts',
    aspPage: 'Advanced_AiDisk_samba.asp',
    title: 'USB Share Accounts & Permissions',
    navGroup: 'usb',
    navOrder: 57,
    confidence: { read: 'structural' },
    component: UsbAccountsPage,
  },
];
