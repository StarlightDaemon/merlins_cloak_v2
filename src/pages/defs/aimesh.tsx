/**
 * AiMesh Node Management (AiMesh.asp — the top-level entry point that loads
 * the modern topology UI, aimesh/aimesh_topology.html; the legacy panel is
 * device-map/amesh.asp). Firmware citations below are to
 * RAW\merlin\release\src\router\httpd\web.c and the two www trees per the
 * research brief (scratchpad/research/05-aimesh.md). Example MACs in this
 * file and its comments are fictional, in the 02: locally-administered range.
 *
 * ---------------------------------------------------------------------------
 * READ (structural — sourced from firmware analysis, not yet live-verified):
 * ---------------------------------------------------------------------------
 *  - get_cfg_clientlist — ej_get_cfg_clientlist, web.c:36451-37053, registered
 *    web.c:42352. Backed by the CM_CLIENT_TABLE SysV shared-memory segment
 *    (web.c:36507-36525) filled by the out-of-tree amas config daemon; index 0
 *    is always the local/CAP router (web.c:36588), indices 1..N are AiMesh RE
 *    nodes. Per-node fields consumed here: mac, alias, model_name/
 *    ui_model_name, fwver/newfwver, ip, online ("1"/"0", index 0 hardcoded
 *    online), level (hop depth), re_path (active backhaul bitmask, decoded
 *    client-side by handle_re_path() at amesh.asp:532-559 — bits 1/16/32/64 =
 *    wired-like, 2 = 2.4G, 128 = 6G, 512 = MLO, else 5G), rssi2g/rssi5g/rssi6g,
 *    and the per-node config JSON (web.c:36676-36700: config.misc.cfg_alias =
 *    location label, config.ctrl_led/lp55xx_led/central_led = LED state).
 *  - get_onboardinglist — ej_get_onboardinglist, web.c:37562-37699, registered
 *    web.c:42356. Nearby unconfigured candidates, keyed by parent-RE-MAC ->
 *    { candidateMac -> {rssi, model_name, source, ...} }. Shown READ-ONLY,
 *    informational only — no pairing controls (see deferred list below).
 *  - get_onboardingstatus — ej_get_onboardingstatus, web.c:37701-37729,
 *    registered web.c:42357. Plain nvram_safe_get fields (cfg_recount,
 *    cfg_re_maxnum, cfg_ready, cfg_obstatus, ...), shown READ-ONLY.
 *  - No-nodes rendering: get_cfg_clientlist always contains at least the
 *    master at index 0, so "no additional nodes" is length <= 1 — handled
 *    below without the native UI's borrowed VS-rule-list placeholder string.
 *    A wholly empty/malformed response degrades to an explicit empty state
 *    rather than a crash (defensive parsing throughout).
 *
 * ---------------------------------------------------------------------------
 * WRITE — exactly three per-node actions, all structural-only, all routed
 * through the guarded chokepoint (guardedWrite, lib/write-guard.ts) exactly
 * like the wol.tsx action_mode=' Refresh ' precedent. Read-only mode previews
 * the exact request instead of sending it; no write below has ever been
 * live-submitted (confidence.write = 'unverified-write').
 * ---------------------------------------------------------------------------
 *  1. Reboot node — action_mode=device_reboot, field device_list=<node MAC>.
 *     Handler web.c:14525-14594 (shared branch with re_reconnect/
 *     force_roaming — this page only ever sends device_reboot). THE EMPTY-
 *     TARGET WHOLE-MESH FOOTGUN: native code reuses this same action_mode
 *     with NO device_list to reboot every mesh node at once
 *     (aimesh_system_settings.html:723). This page structurally prevents that
 *     variant: the target MAC is always baked from the clicked row (never a
 *     free-text field), the Reboot control does not exist for the master/CAP
 *     row (index 0 — rebooting "the node this session is talking through" is
 *     out of scope for a per-node action), and rebootNode() asserts a
 *     non-empty, MAC-shaped target before buildWriteRequest() is ever called.
 *  2. LED on/off — action_mode=config_changed, fields re_mac=<node MAC>,
 *     config=JSON.stringify({led_val: '1'|'0'}). Mirrors the per-node
 *     iteration in aimesh_system_settings.html:570-574 (the mesh-wide LED
 *     toggle sends this exact shape once per node, with re_mac set).
 *  3. Location/alias — action_mode=config_changed, fields re_mac=<node MAC>,
 *     config=JSON.stringify({cfg_alias: <value>}). Mirrors
 *     aimesh_topology.html:311-317 (manage_set_config for RE nodes).
 *     Client-side constraint carried over from aimesh_topology.html:280-305:
 *     non-blank, no '"' character, <=32 UTF-8 bytes — NOT re-validated
 *     server-side in the branches read, so this UI enforces it before send.
 *  Both (2) and (3) share the config_changed handler at web.c:14486-14497,
 *  which requires both re_mac and config and forwards config to the AMAS
 *  daemon as an UNVALIDATED JSON pass-through (no server-side key allowlist)
 *  — flagged per the brief §2.6. setLed()/setLocation() assert a non-empty
 *  target MAC before building the request, same as rebootNode().
 *  None of the three actions write local router nvram (the effect lands on
 *  the remote node), so no write here has an nvram key to verify against —
 *  verifyKeys is null throughout, same as WOL's ether-wake precedent.
 *
 *  RTCONFIG_CFGSYNC build-conditional caveat: every action_mode branch above
 *  lives inside an #ifdef RTCONFIG_CFGSYNC block opening before web.c:14382
 *  and closing at web.c:14612-14613. On a firmware build without cfg-sync
 *  compiled in, none of these branches exist — apply_cgi() falls straight
 *  through to APPLY_FINISH (web.c:14648-14654) and the POST is a silent
 *  no-op with no error. The amas_support gate below does not by itself prove
 *  cfg-sync is compiled in; a write here can still land as a no-op on such a
 *  build, and the only observable symptom is "nothing happened."
 *
 * ---------------------------------------------------------------------------
 * Deliberately DEFERRED (not implemented anywhere on this page):
 * ---------------------------------------------------------------------------
 *  - Onboarding / pairing (action_mode=onboarding / ob_selection,
 *    web.c:14459-14485) — multi-step search-then-lock state machine shared
 *    across two forms and a poll loop; mistargeting new_re_mac pairs an
 *    unintended physical device into the mesh (brief §5).
 *  - Node removal (action_mode=reset_default / remove_slave,
 *    web.c:14398-14447) — factory-resets and evicts the target node, and an
 *    EMPTY slave_mac factory-resets the entire mesh
 *    (aimesh_system_settings.html:690) — factory-reset blast radius, the
 *    same class of risk this page's writeExclusion tag names below.
 *  - re_reconnect (shares the device_reboot handler, web.c:14525-14594) —
 *    forces a topology re-negotiation; severing a mid-tree node's backhaul
 *    can cascade-disconnect every node below it, not just the target.
 *  - force_roaming (same handler family, web.c:14525-14594) — targets a
 *    wireless CLIENT, not a mesh node; out of this page's node-management
 *    scope.
 *  - prefer_node_apply / backhaul preference (web.c:14596-14611) —
 *    build-conditional (#ifdef RTCONFIG_BHCOST_OPT only) and the native UI's
 *    own confirm copy warns the node will drop and need to reconnect; same
 *    cascading-disconnect risk as re_reconnect.
 *
 * ---------------------------------------------------------------------------
 * Safety classification:
 * ---------------------------------------------------------------------------
 * confidence: { read: 'structural', write: 'unverified-write' }.
 * writeExclusion: 'firmware-reboot-reset'. The brief's own §4 argues no
 * existing category fits this surface cleanly and floats a bespoke
 * 'aimesh-topology' tag — deliberately NOT adopted here: the task scope for
 * this page keeps only the three lowest-risk, non-destructive actions (node
 * reboot, LED, location), and 'firmware-reboot-reset' is the closest existing
 * category for the one action that actually reboots a physical device
 * (reboot node) and for the disposition of everything this page defers
 * (removal/reset are squarely factory-reset class). LED/location writes are
 * tagged the same for a single, auditable page-level policy rather than a
 * mixed per-action scheme. No write on this page has ever been live-
 * submitted; every action funnels through the ordinary read-only interlock
 * and preview UX, same as wol.tsx.
 */
import { useCallback, useEffect, useState } from 'react';
import { appGet } from '../../lib/router-io';
import { guardedWrite, isReadOnlyMode, type GuardedWriteOutcome } from '../../lib/write-guard';
import { hasFlag } from '../../lib/capabilities';
import type { PageDef, PageProps } from '../types';
import { Badge, Banner, Button, Card, EmptyState, Loading, TextInput } from '../../ui/components';

const MAC_PATTERN = /^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$/;

interface NodeRow {
  mac: string;
  alias: string;
  model: string;
  fwver: string;
  newfwver: string;
  ip: string;
  online: boolean;
  isMaster: boolean;
  level: string;
  backhaul: string;
  rssi: string;
  ledOn: boolean | null;
}

interface OnboardCandidate {
  parentMac: string;
  candidateMac: string;
  rssi: string;
  model: string;
  source: string;
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return v != null && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

/** config/capability side-objects sometimes arrive pre-parsed, sometimes as a JSON string. */
function parseMaybeJson(v: unknown): Record<string, unknown> | null {
  if (v == null) return null;
  if (typeof v === 'object') return asRecord(v);
  if (typeof v === 'string' && v.trim().startsWith('{')) {
    try {
      return asRecord(JSON.parse(v));
    } catch {
      return null;
    }
  }
  return null;
}

/** re_path bitmask decode per amesh.asp:532-559 (handle_re_path). */
function decodeBackhaul(rePath: unknown): string {
  const n = Number(rePath);
  if (!Number.isFinite(n) || n === 0) return 'Unknown';
  if ((n & 512) !== 0) return 'MLO';
  if ((n & 128) !== 0) return '6 GHz';
  if ((n & 2) !== 0) return '2.4 GHz';
  if ((n & 1) !== 0 || (n & 16) !== 0 || (n & 32) !== 0 || (n & 64) !== 0) return 'Wired';
  return '5 GHz';
}

function pickRssi(entry: Record<string, unknown>, backhaul: string): string {
  const key = backhaul === '2.4 GHz' ? 'rssi2g' : backhaul === '5 GHz' ? 'rssi5g' : backhaul === '6 GHz' ? 'rssi6g' : null;
  if (!key) return '';
  const v = entry[key];
  return v == null || v === '' ? '' : String(v);
}

/** Defensive: tolerates get_cfg_clientlist arriving as an array OR an object of node records. */
function parseCfgClientlist(raw: unknown): NodeRow[] {
  let list: unknown[];
  if (Array.isArray(raw)) list = raw;
  else if (raw != null && typeof raw === 'object') list = Object.values(raw as Record<string, unknown>);
  else list = [];

  const rows: NodeRow[] = [];
  list.forEach((entryRaw, i) => {
    const entry = asRecord(entryRaw);
    if (!entry) return;
    const mac = String(entry.mac ?? '').toUpperCase();
    if (!MAC_PATTERN.test(mac)) return; // malformed record — skip rather than render garbage
    const config = parseMaybeJson(entry.config);
    const ledRaw = config ? (config.ctrl_led ?? config.lp55xx_led ?? config.central_led) : undefined;
    const backhaul = decodeBackhaul(entry.re_path);
    rows.push({
      mac,
      alias: String(entry.alias ?? '') || mac,
      model: String(entry.ui_model_name ?? entry.model_name ?? '') || '—',
      fwver: String(entry.fwver ?? ''),
      newfwver: String(entry.newfwver ?? ''),
      ip: String(entry.ip ?? ''),
      online: i === 0 || String(entry.online ?? '') === '1',
      isMaster: i === 0,
      level: String(entry.level ?? ''),
      backhaul,
      rssi: pickRssi(entry, backhaul),
      ledOn: ledRaw == null ? null : String(ledRaw) === '1',
    });
  });
  return rows;
}

function parseOnboardingList(raw: unknown): OnboardCandidate[] {
  const top = asRecord(raw);
  if (!top) return [];
  const out: OnboardCandidate[] = [];
  for (const [parentMac, candidatesRaw] of Object.entries(top)) {
    const candidates = asRecord(candidatesRaw);
    if (!candidates) continue;
    for (const [candidateMac, infoRaw] of Object.entries(candidates)) {
      const info = asRecord(infoRaw);
      if (!info) continue;
      out.push({
        parentMac: parentMac.toUpperCase(),
        candidateMac: candidateMac.toUpperCase(),
        rssi: String(info.rssi ?? ''),
        model: String(info.model_name ?? '') || '—',
        source: String(info.source ?? ''),
      });
    }
  }
  return out;
}

const OB_STATUS_LABEL: Record<string, string> = {
  '': 'not ready',
  '1': 'idle / ready to search',
  '2': 'searching',
  '4': 'locked onto a candidate',
};

function AiMeshPage(_props: PageProps) {
  const [nodes, setNodes] = useState<NodeRow[] | null>(null);
  const [candidates, setCandidates] = useState<OnboardCandidate[]>([]);
  const [status, setStatus] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyMac, setBusyMac] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<GuardedWriteOutcome | null>(null);
  const [locationDraft, setLocationDraft] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    try {
      const raw = await appGet(['get_cfg_clientlist()', 'get_onboardinglist()', 'get_onboardingstatus()']);
      setNodes(parseCfgClientlist(raw.get_cfg_clientlist));
      setCandidates(parseOnboardingList(raw.get_onboardinglist));
      setStatus(asRecord(raw.get_onboardingstatus));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const rebootNode = useCallback(
    async (mac: string) => {
      const target = mac.trim().toUpperCase();
      // Structural guard against the empty-target whole-mesh reboot variant
      // (aimesh_system_settings.html:723): this must never fire with an empty
      // or malformed target, regardless of what called it.
      if (!MAC_PATTERN.test(target)) throw new Error('aimesh: refusing device_reboot with a non-MAC target');
      setBusyMac(target);
      try {
        const result = await guardedWrite(
          {
            endpoint: 'applyapp',
            writeExclusion: 'firmware-reboot-reset',
            actionMode: 'device_reboot',
            fields: { device_list: target },
            currentPage: 'AiMesh.asp',
          },
          null,
        );
        setOutcome(result);
      } finally {
        setBusyMac(null);
      }
    },
    [],
  );

  const setLed = useCallback(
    async (mac: string, on: boolean) => {
      const target = mac.trim().toUpperCase();
      if (!MAC_PATTERN.test(target)) throw new Error('aimesh: refusing config_changed with a non-MAC target');
      setBusyMac(target);
      try {
        const result = await guardedWrite(
          {
            endpoint: 'applyapp',
            writeExclusion: 'firmware-reboot-reset',
            actionMode: 'config_changed',
            fields: { re_mac: target, config: JSON.stringify({ led_val: on ? '1' : '0' }) },
            currentPage: 'AiMesh.asp',
          },
          null,
        );
        setOutcome(result);
        if (result.applied) await load();
      } finally {
        setBusyMac(null);
      }
    },
    [load],
  );

  const saveLocation = useCallback(
    async (mac: string, value: string) => {
      const target = mac.trim().toUpperCase();
      if (!MAC_PATTERN.test(target)) throw new Error('aimesh: refusing config_changed with a non-MAC target');
      setBusyMac(target);
      try {
        const result = await guardedWrite(
          {
            endpoint: 'applyapp',
            writeExclusion: 'firmware-reboot-reset',
            actionMode: 'config_changed',
            fields: { re_mac: target, config: JSON.stringify({ cfg_alias: value }) },
            currentPage: 'AiMesh.asp',
          },
          null,
        );
        setOutcome(result);
        if (result.applied) {
          setLocationDraft((d) => {
            const next = { ...d };
            delete next[target];
            return next;
          });
          await load();
        }
      } finally {
        setBusyMac(null);
      }
    },
    [load],
  );

  function renderMesh(nodes: NodeRow[]) {
    const extraCount = nodes.filter((n) => !n.isMaster).length;
    const onlineCount = nodes.filter((n) => n.online).length;
    return (
      <>
        {isReadOnlyMode() && (
          <Banner tone="info">
            Read-only mode: Reboot, LED, and Save location preview the exact request without sending it.
          </Banner>
        )}
        <div className="mc-feedbar">
          <Button small onClick={() => void load()}>
            Refresh
          </Button>
        </div>

        {nodes.length === 0 ? (
          <EmptyState>No AiMesh node data returned by the router.</EmptyState>
        ) : (
          <Card title={`Mesh nodes (${nodes.length}, ${onlineCount} online)`}>
            {extraCount === 0 && (
              <p className="mc-card__note">
                No additional AiMesh nodes found — this router is currently running solo (only the CAP/master row below).
              </p>
            )}
            <table className="mc-table mc-table--mono">
              <thead>
                <tr>
                  <th>Alias / location</th>
                  <th>Model</th>
                  <th>MAC address</th>
                  <th>IP</th>
                  <th>Firmware</th>
                  <th>Status</th>
                  <th>Hop</th>
                  <th>Backhaul</th>
                  <th className="num">Signal</th>
                  <th style={{ width: 260 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {nodes.map((n) => {
                  const busy = busyMac === n.mac;
                  const draft = locationDraft[n.mac];
                  return (
                    <tr key={n.mac}>
                      <td>
                        {n.alias}
                        {n.isMaster && (
                          <>
                            {' '}
                            <Badge tone="info">CAP</Badge>
                          </>
                        )}
                      </td>
                      <td>{n.model}</td>
                      <td>{n.mac}</td>
                      <td>{n.ip || '—'}</td>
                      <td>
                        {n.fwver || '—'}
                        {n.newfwver && n.newfwver !== n.fwver ? ` (update: ${n.newfwver})` : ''}
                      </td>
                      <td>
                        <Badge tone={n.online ? 'ok' : 'err'}>{n.online ? 'online' : 'offline'}</Badge>
                      </td>
                      <td>{n.isMaster ? '—' : n.level || '—'}</td>
                      <td>{n.isMaster ? '—' : n.backhaul}</td>
                      <td className="num">{n.isMaster ? '—' : n.rssi || '—'}</td>
                      <td>
                        {n.isMaster ? (
                          <span style={{ opacity: 0.5 }}>this router — no per-node actions</span>
                        ) : draft !== undefined ? (
                          <div>
                            <TextInput
                              value={draft}
                              onChange={(v) => setLocationDraft((d) => ({ ...d, [n.mac]: v }))}
                              width={140}
                            />{' '}
                            <Button
                              small
                              variant="primary"
                              disabled={busy || !draft.trim() || draft.includes('"') || draft.length > 32}
                              onClick={() => void saveLocation(n.mac, draft.trim())}
                            >
                              {isReadOnlyMode() ? 'Preview' : 'Save'}
                            </Button>{' '}
                            <Button
                              small
                              disabled={busy}
                              onClick={() =>
                                setLocationDraft((d) => {
                                  const next = { ...d };
                                  delete next[n.mac];
                                  return next;
                                })
                              }
                            >
                              Cancel
                            </Button>
                          </div>
                        ) : (
                          <>
                            <Button small disabled={busy} onClick={() => void rebootNode(n.mac)}>
                              {isReadOnlyMode() ? 'Preview reboot' : 'Reboot'}
                            </Button>{' '}
                            <Button small disabled={busy} onClick={() => void setLed(n.mac, !(n.ledOn ?? true))}>
                              {n.ledOn === null ? 'LED toggle' : n.ledOn ? 'LED off' : 'LED on'}
                            </Button>{' '}
                            <Button
                              small
                              disabled={busy}
                              onClick={() => setLocationDraft((d) => ({ ...d, [n.mac]: n.alias }))}
                            >
                              Edit location
                            </Button>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="mc-card__note">
              LED and location writes forward an unvalidated JSON payload to the target node&apos;s own config daemon
              (config_changed, web.c:14486-14497) — the router&apos;s httpd performs no schema check on it.
            </p>
          </Card>
        )}

        <Card title="Onboarding (read-only)" note="Pairing/removal are not implemented on this page — see the file header for why.">
          {status && (
            <p className="mc-card__note">
              Node count: {String(status.cfg_recount ?? '—')} / {String(status.cfg_re_maxnum ?? '—')} · Config daemon
              ready: {String(status.cfg_ready ?? '—') === '1' ? 'yes' : 'no'} · Search state:{' '}
              {OB_STATUS_LABEL[String(status.cfg_obstatus ?? '')] ?? String(status.cfg_obstatus ?? '—')}
            </p>
          )}
          {candidates.length === 0 ? (
            <EmptyState>No unconfigured AiMesh candidates currently visible.</EmptyState>
          ) : (
            <table className="mc-table mc-table--mono">
              <thead>
                <tr>
                  <th>Candidate MAC</th>
                  <th>Model</th>
                  <th>Seen via parent</th>
                  <th className="num">Signal</th>
                  <th>Source</th>
                </tr>
              </thead>
              <tbody>
                {candidates.map((c, i) => (
                  <tr key={`${c.parentMac}-${c.candidateMac}-${i}`}>
                    <td>{c.candidateMac}</td>
                    <td>{c.model}</td>
                    <td>{c.parentMac}</td>
                    <td className="num">{c.rssi || '—'}</td>
                    <td>{c.source || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        {outcome && (
          <Banner tone={outcome.dryRun ? 'info' : outcome.applied ? 'info' : 'err'}>
            <Badge tone={outcome.dryRun ? 'info' : outcome.applied ? 'ok' : 'err'}>
              {outcome.blocked ? 'BLOCKED' : outcome.dryRun ? 'DRY RUN' : outcome.applied ? 'DONE' : 'SENT (unconfirmed)'}
            </Badge>{' '}
            <code>POST {outcome.entry.request.url}</code> · <code>{outcome.entry.request.body}</code>
            {outcome.blockedReason && <div>{outcome.blockedReason}</div>}
          </Banner>
        )}
      </>
    );
  }

  return (
    <div>
      <h1 className="mc-page-title">AiMesh Node Management</h1>
      <p className="mc-page-subtitle">AiMesh.asp</p>
      {error ? (
        <Banner tone="err">Failed to read AiMesh node data: {error}</Banner>
      ) : !nodes ? (
        <Loading />
      ) : (
        renderMesh(nodes)
      )}
    </div>
  );
}

export const aimeshPages: PageDef[] = [
  {
    kind: 'custom',
    id: 'aimesh',
    aspPage: 'AiMesh.asp',
    title: 'AiMesh Node Management',
    navGroup: 'lan',
    navSub: 'segments',
    navOrder: 17,
    // Not merlinOnly: AiMesh (amas_support) is present on both Merlin and
    // stock firmware trees (RAW\merlin\...\aimesh\ and
    // RAW\stock\extracted\asuswrt\...\aimesh\ both exist) — gating is solely
    // the amas_support capability flag below.
    gate: (caps) => hasFlag(caps, 'amas_support'),
    confidence: { read: 'structural', write: 'unverified-write' },
    writeExclusion: 'firmware-reboot-reset',
    component: AiMeshPage,
  },
];
