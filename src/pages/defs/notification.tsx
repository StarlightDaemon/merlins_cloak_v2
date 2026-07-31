/**
 * Notification Center (NC v2) — the bell icon's event list. Custom read
 * (+ mark-read) page over `get_nt_db()` and the static `nt_content.json`
 * display templates.
 *
 * NOT the same as the legacy `www\notification.js` client-side nag bell
 * (system-health checks computed from already-loaded nvram, no DB, no
 * read/unread state) — that subsystem is out of scope entirely. This page is
 * the persistent, server-backed NC v2 (`RTCONFIG_NOTIFICATION_CENTER`,
 * `shared\nt\nt_common.h:15`).
 *
 * Read surface:
 *  - Event list: `appGet.cgi?hook=get_nt_db()`, an ej hook (not a URL
 *    endpoint) — `{ "get_nt_db", ej_get_nt_db }` (web.c:42363) →
 *    `ej_get_nt_db` → `get_nt_db_type(wp, 0)` (web.c:37852-37945). Each row:
 *    `{tstamp, event_id, group_type, msg, eName, status, event_type}`.
 *    `event_id` is written with `"%8X"` (web.c:37920) — an UNPADDED,
 *    space-left-padded 8-column uppercase hex field, e.g. `"   10003"` — so it
 *    MUST be trimmed before use as an `nt_content.json` key or before it is
 *    echoed back in a mark-read submit. `status` is a per-channel bitmask
 *    (`nt_common.h:90-93`); the native GUI's own "is this read" test is the
 *    narrow `status == 1` (bit 0 / web-GUI channel only, nothing else) —
 *    replicated exactly below, not a generic `status !== 0`.
 *  - Display templates: plain same-origin `GET /nt_content.json`
 *    (`www\notification_center\nt_content.json`), fetched live rather than
 *    vendored — this is the ONLY practical source of human-readable event
 *    names in scope. `eInfo_get_eName`/`eInfo_get_eType` (the server's
 *    authoritative resolver, `shared\nt\libnt.h:35-38`) are declared but their
 *    `.c` implementation is not shipped in any of the four vendored GPL trees
 *    — a real source gap, not a shortcut. The firmware DOES still return a
 *    live `eName` string per row (compiled in, just not inspectable from
 *    source), so it is used as a secondary label when the template file has
 *    no entry for that event id or the fetch fails. `nt_content.json`'s
 *    key space and `nt_common.h`'s NC v2 `#define` event-id space do not
 *    visibly line up (see research brief §2) — unknown ids are expected, not
 *    an error, and are rendered via the raw-hex fallback path.
 *  - Settings (read-only display only): `nc_web_app_enable` / `nc_mail_enable`
 *    nvram booleans (`shared\defaults.c:4151-4155`). `nc_setting_conf`
 *    (per-event channel/type prefs) is deliberately NOT read or shown — it is
 *    a single nvram string requiring a full read-modify-write to touch any
 *    one event (`notification.js:178-193`), a footgun with no per-item PATCH;
 *    out of scope per the brief's recommendation.
 *  - `get_nt_db.cgi` / `get_nc_conf.cgi` (structured, paginated alternatives
 *    at web.c:20454-20568 / :20639-20670) exist but are app/API surfaces the
 *    native web GUI itself never calls — mirroring the GUI's own ej-hook path
 *    instead, per the brief.
 *
 * Write surface — mark-read only:
 *  `action_mode=nt_apply` is a dedicated branch INSIDE `apply_cgi`
 *  (`#ifdef RTCONFIG_NOTIFICATION_CENTER`, web.c:13969-14098), reached
 *  identically via `/apply.cgi` (native) or `/applyapp.cgi` (this extension's
 *  'applyapp' WriteEndpoint) — both cgi-table entries dispatch to the same
 *  `do_apply_cgi` → `apply_cgi()` (web.c:28365-28366, :14703-14706), so the
 *  existing guarded write chokepoint (lib/write-guard.ts → lib/router-io.ts
 *  buildWriteRequest/'applyapp') expresses this action_mode with no new
 *  channel. `nt_action=write` (single event, web.c:13989-14037) and
 *  `nt_action=readall` (web.c:14048-14082) are implemented; `delete` and
 *  `delete_all` are NOT (see below). Both implemented actions:
 *   - touch ONLY the closed-source NC event-log DB (not nvram) — there is
 *     nothing to `nvram get` afterward, so `buildVerify`/the guardedWrite
 *     verifyKeys argument is `null` (no confirmation read is possible; the
 *     UI's own list reload after `outcome.applied` is the only feedback);
 *   - issue NO `notify_rc()` call in either branch (confirmed absent from
 *     web.c:13989-14082) — no service restart, no network/wireless/WAN/DHCP/
 *     VPN/firewall/firmware side effect;
 *   - are therefore tagged `writeExclusion: null` per the research brief §5's
 *     explicit recommendation (same risk tier as a UI-only preference
 *     toggle). This is a DELIBERATE, REVIEWED choice, not an oversight — and
 *     `confidence.write` stays `'unverified-write'`: this write path has
 *     NEVER been submitted against live hardware in this project's history.
 *  Deliberately NOT implemented (do not add without a fresh scoping pass):
 *   - `nt_action=delete` / `delete_all` — `delete_all` unlinks the ENTIRE
 *     NC v2 db file for every channel (`unlink(NTDB_V2)`, web.c:14084-14089)
 *     with no native UI button behind it at all;
 *   - per-event `nc_setting_conf` type/channel edits — read-modify-write
 *     footgun, plus a real `notify_rc` restart (`update_nc_setting_conf`);
 *   - the "Block device" shortcut on new-device-connected events
 *     (`notification.js:324-344`) — a full wireless ACL write
 *     (`wl_maclist_x`/`wl_macmode=deny`) in a notification-center costume;
 *     wireless writes are hard-excluded in this project regardless.
 *
 * Gating: `nt_center_support = isSupport("nt_center") && isSupport("nt_center_ui")`
 * (`www\state.js:747`). Per the task scope this page ANDs both underlying
 * flags explicitly (`nt_center_support` AND `nt_center_ui_support`) rather
 * than relying solely on the pre-ANDed global, so a stale/absent collector
 * value for either token still gates the page off.
 *
 * aspPage: no `.asp` file backs the bell/event-list itself — its DOM shell
 * could not be located in any scanned `.asp` (brief §0, "Explicitly
 * unconfirmed"), unlike the separate standalone settings page
 * (`Advanced_Notification_Content.asp`, not what this page shows). Using the
 * synthetic `'(header bell)'` identity per the task's own fallback
 * instruction, mirroring how `defs/index.ts` uses the synthetic
 * `'(extension)'` identity for pages with no native counterpart at all.
 *
 * Not replicated here: the native dropdown's per-channel `web_display()`
 * filter (`notification.js:347-357`, a `group` bitmask parse) that hides
 * app/IFTTT/Alexa-only events from the web GUI. This page shows every row
 * `get_nt_db()` returns — a deliberate superset of the native web view, not
 * a bug — because filtering on an unconfirmed/possibly-stale template field
 * risks hiding events the operator actually wants to see.
 */
import { useCallback, useEffect, useState } from 'react';
import { hasFlag } from '../../lib/capabilities';
import { fetchRouterText, nvramGet } from '../../lib/router-io';
import { guardedWrite, isReadOnlyMode, type GuardedWriteOutcome } from '../../lib/write-guard';
import type { PageDef, PageProps } from '../types';
import { Badge, Banner, Button, Card, EmptyState, Loading } from '../../ui/components';

interface NtDbEntry {
  tstamp: string;
  event_id: string;
  group_type: string;
  msg: unknown;
  eName: string;
  status: string;
  event_type: string;
}

interface NtContentEntry {
  item?: string;
  contents?: string;
  icon?: string;
  group?: string;
}

type NtContentMap = Record<string, NtContentEntry>;

interface NtData {
  events: NtDbEntry[];
  content: NtContentMap | null;
  ncWebAppEnable: string;
  ncMailEnable: string;
}

/** appGet.cgi hook — { "get_nt_db": [ {...}, ... ] } per web.c:37904-37922. */
async function fetchNtDb(): Promise<NtDbEntry[]> {
  const text = await fetchRouterText('/appGet.cgi?hook=' + encodeURIComponent('get_nt_db()'));
  const trimmed = text.trim().replace(/;+\s*$/, '');
  const parsed = JSON.parse(trimmed) as Record<string, unknown>;
  const rows = parsed.get_nt_db;
  return Array.isArray(rows) ? (rows as NtDbEntry[]) : [];
}

/**
 * Static display-template file, same-origin GET — not an appGet/ej hook.
 * `fetchRouterText` already covers a plain same-origin GET (login-page
 * detection, 404 → RouterIOError) so no new router-io helper is needed here.
 * Any failure (404 on older/differently-built firmware, malformed JSON,
 * session loss) degrades to `null` — callers fall back to raw hex + status.
 */
async function fetchNtContent(): Promise<NtContentMap | null> {
  try {
    const text = await fetchRouterText('/nt_content.json');
    const parsed = JSON.parse(text) as unknown;
    return parsed && typeof parsed === 'object' ? (parsed as NtContentMap) : null;
  } catch {
    return null;
  }
}

async function loadNtData(): Promise<NtData> {
  const [events, content, nc] = await Promise.all([
    fetchNtDb(),
    fetchNtContent(),
    nvramGet(['nc_web_app_enable', 'nc_mail_enable']),
  ]);
  events.sort((a, b) => Number(b.tstamp) - Number(a.tstamp));
  return { events, content, ncWebAppEnable: nc.nc_web_app_enable, ncMailEnable: nc.nc_mail_enable };
}

/** Native GUI's own "read" test is exactly bit 0 set and nothing else. */
function isReadWeb(status: string): boolean {
  return Number(status) === 1;
}

function fmtTimestamp(tstamp: string): string {
  const n = Number(tstamp);
  if (!Number.isFinite(n) || n <= 0) return tstamp;
  return new Date(n * 1000).toLocaleString();
}

function eventTitle(entry: NtDbEntry, content: NtContentMap | null): string {
  const key = entry.event_id.trim();
  const tpl = content?.[key];
  if (tpl?.item) return tpl.item;
  if (entry.eName?.trim()) return entry.eName.trim();
  return `Event 0x${key}`;
}

function eventBody(entry: NtDbEntry, content: NtContentMap | null): string {
  const key = entry.event_id.trim();
  const tpl = content?.[key];
  if (tpl?.contents) return tpl.contents;
  if (typeof entry.msg === 'string') return entry.msg;
  if (entry.msg && typeof entry.msg === 'object') {
    try {
      return JSON.stringify(entry.msg);
    } catch {
      // fall through
    }
  }
  return `raw event id 0x${key} · status flags ${entry.status}`;
}

function NotificationCenterPage(_props: PageProps) {
  const [data, setData] = useState<NtData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyTstamp, setBusyTstamp] = useState<string | null>(null);
  const [busyAll, setBusyAll] = useState(false);
  const [outcome, setOutcome] = useState<GuardedWriteOutcome | null>(null);

  const load = useCallback(async () => {
    try {
      setData(await loadNtData());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const markRead = useCallback(
    async (entry: NtDbEntry) => {
      setBusyTstamp(entry.tstamp);
      try {
        const result = await guardedWrite(
          {
            endpoint: 'applyapp',
            // Deliberate, reviewed: see header comment — nt_apply write/readall
            // touch only the closed-source NC event DB, issue no notify_rc, and
            // the research brief explicitly recommends `null` here (§5).
            writeExclusion: null,
            actionMode: 'nt_apply',
            fields: { nt_action: 'write', nt_event: entry.event_id.trim(), tstamp: entry.tstamp, nt_status: '1' },
            currentPage: '(header bell)',
          },
          // No nvram key results from this action (web.c:13989-14037 writes only
          // the closed-source NT DB) — nothing to forced-fresh-verify.
          null,
        );
        setOutcome(result);
        if (result.applied) await load();
      } finally {
        setBusyTstamp(null);
      }
    },
    [load],
  );

  const markAllRead = useCallback(async () => {
    setBusyAll(true);
    try {
      const result = await guardedWrite(
        {
          endpoint: 'applyapp',
          writeExclusion: null,
          actionMode: 'nt_apply',
          fields: { nt_action: 'readall' },
          currentPage: '(header bell)',
        },
        null,
      );
      setOutcome(result);
      if (result.applied) await load();
    } finally {
      setBusyAll(false);
    }
  }, [load]);

  const anyUnread = !!data?.events.some((e) => !isReadWeb(e.status));

  return (
    <div>
      <h1 className="mc-page-title">Notification Center</h1>
      <p className="mc-page-subtitle">(header bell) · get_nt_db()</p>
      {isReadOnlyMode() && (
        <Banner tone="info">Read-only mode: Mark read / Mark all read preview the exact request without sending it.</Banner>
      )}
      <Banner tone="info">
        Notification history lives in <code>/jffs/.sys/nc/</code> when JFFS is enabled, otherwise{' '}
        <code>/tmp/nc/</code> — it can be lost on reboot unless JFFS storage is enabled elsewhere in Administration.
      </Banner>
      {error && <Banner tone="err">Failed to read notification data: {error}</Banner>}
      {!data && !error ? (
        <Loading />
      ) : data ? (
        <>
          <Card title="Channel settings (read-only)" note="Editing nc_setting_conf / channel toggles is out of scope — see header comment.">
            <p>
              Web/App notifications:{' '}
              <Badge tone={data.ncWebAppEnable === '1' ? 'ok' : 'info'}>
                {data.ncWebAppEnable === '1' ? 'Enabled' : 'Disabled'}
              </Badge>{' '}
              · Email notifications:{' '}
              <Badge tone={data.ncMailEnable === '1' ? 'ok' : 'info'}>
                {data.ncMailEnable === '1' ? 'Enabled' : 'Disabled'}
              </Badge>
            </p>
            {!data.content && (
              <p className="mc-card__note">
                /nt_content.json could not be fetched (404 or unreadable) — event names fall back to the firmware's
                own eName field, then a raw hex id.
              </p>
            )}
          </Card>
          <Card
            title={
              <>
                Events ({data.events.length})
                <span style={{ marginLeft: 'auto' }}>
                  <Button small disabled={busyAll || !anyUnread} onClick={() => void markAllRead()}>
                    {isReadOnlyMode() ? 'Preview mark all read' : 'Mark all as read'}
                  </Button>
                </span>
              </>
            }
          >
            {data.events.length === 0 ? (
              <EmptyState>No notifications</EmptyState>
            ) : (
              <table className="mc-table">
                <thead>
                  <tr>
                    <th>When</th>
                    <th>Event</th>
                    <th>Status</th>
                    <th style={{ width: 140 }} />
                  </tr>
                </thead>
                <tbody>
                  {data.events.map((e) => {
                    const read = isReadWeb(e.status);
                    return (
                      <tr key={`${e.tstamp}-${e.event_id}`}>
                        <td className="num">{fmtTimestamp(e.tstamp)}</td>
                        <td>
                          <div>{eventTitle(e, data.content)}</div>
                          <div className="mc-card__note">{eventBody(e, data.content)}</div>
                        </td>
                        <td>
                          <Badge tone={read ? 'info' : 'ok'}>{read ? 'Read' : 'Unread'}</Badge>
                        </td>
                        <td>
                          {!read && (
                            <Button small disabled={busyTstamp === e.tstamp} onClick={() => void markRead(e)}>
                              {isReadOnlyMode() ? 'Preview' : 'Mark read'}
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </Card>
        </>
      ) : null}
      {outcome && (
        <Banner tone={outcome.dryRun ? 'info' : outcome.applied ? 'info' : 'err'}>
          <Badge tone={outcome.dryRun ? 'info' : outcome.applied ? 'ok' : 'err'}>
            {outcome.dryRun ? 'DRY RUN' : outcome.applied ? 'DONE' : 'SENT (unconfirmed)'}
          </Badge>{' '}
          <code>POST {outcome.entry.request.url}</code> · <code>{outcome.entry.request.body}</code>
        </Banner>
      )}
    </div>
  );
}

export const notificationPages: PageDef[] = [
  {
    kind: 'custom',
    id: 'notification-center',
    aspPage: '(header bell)',
    title: 'Notification Center',
    navGroup: 'status',
    navOrder: 4,
    confidence: { read: 'structural', write: 'unverified-write' },
    writeExclusion: null,
    gate: (caps) => hasFlag(caps, 'nt_center_support') && hasFlag(caps, 'nt_center_ui_support'),
    component: NotificationCenterPage,
  },
];
