/**
 * Self-Defined Networks / Guest Network Pro (SDN.asp) — overview plus
 * guest/IoT-class profile create/edit/delete. Record layouts and the
 * sdn_rl/subnet_rl/apg{idx}_* parsing live in lib/sdn.ts (shared with
 * pages/defs/dashboard.tsx's SDN-aware summary — untouched by this change),
 * as does every write-path helper this page calls.
 *
 * ---------------------------------------------------------------------------
 * SCOPE — what this editor does and does not do
 * ---------------------------------------------------------------------------
 * In scope, for GUEST-CLASS profiles only (any sdn_rl record whose `name` is
 * not MAINFH or MAINBH — isGuestClassSdnName in lib/sdn.ts):
 *   - edit SSID, WPA passphrase, enable/disable, band selection (dut_list)
 *   - create a new guest profile
 *   - delete a guest profile
 * All five are built through the guarded write chokepoint (guardedWrite,
 * lib/write-guard.ts) exactly like every other write in this codebase.
 *
 * MAINFH and MAINBH records are STRICTLY VIEW-ONLY. This is enforced
 * structurally, not just by hiding the Edit/Delete buttons for those rows:
 * lib/sdn.ts's assertGuestClassRow() throws before any mutation is computed
 * for one, and assertNoApmKeys() throws a second time if a constructed
 * payload ever contains an `apm{idx}_*` key (the nvram family MAINFH/MAINBH
 * actually store their fields under — sdn.js `ap_prefix` branch, sdn.js:9552,
 * web.c:3866-3882). Per the research brief's biggest risk finding (§7,
 * scratchpad/research/09-sdn-crud.md), a write that lands on the wrong prefix
 * for a MAINFH/MAINBH row could rename/repassword the router's real
 * broadcast network for every already-connected client — the two guards
 * above make that class of bug structurally unreachable rather than merely
 * unlikely.
 *
 * Explicitly OUT OF SCOPE (never read for editing, never written):
 *   - VLAN trunk membership / AiMesh port binding (dut_list per-node MAC
 *     assignment): native escalates rc_service to restart_net_and_phy for
 *     these (sdn.js:9099-9123), a materially larger blast radius than plain
 *     wireless (physical LAN port + PHY reinit) that this build deliberately
 *     avoids. Band selection here always uses the wildcard "sync to all
 *     nodes" dut_list form instead (`<*>{bitwise}>`, sdn.js:11714-11723) —
 *     see lib/sdn.ts's encodeDutListStar for the full citation.
 *   - Captive portal (cp{idx}_*, idx 1-4 — a fixed 4-slot pool per
 *     cp_type_rl, not a dynamic per-profile index): classified from source
 *     2026-07-31, resolving the earlier "could not classify" note.
 *     cp{idx}_profile / cp{idx}_local_auth_profile are literal
 *     router_defaults entries (defaults.c:3452-3459) with no cp-prefix
 *     branch anywhere in the write chain, so they validate+write via the
 *     generic no-prefix fallback (nvram_check → nvram_set, web.c:4902) —
 *     same class as ipsec_profile_2. cp{idx}_radius_profile has NO
 *     defaults-table entry anywhere and is silently dropped by the same
 *     table-driven mechanism that drops wgs1_* (web.c:4316-4320), even
 *     though native's own sdn.js:12388-12419 posts it too (GPL-vs-binary
 *     version skew, not further resolvable from source). Profile
 *     *creation* (create_sdn_profile.cgi, web.c:27349-27386) reads a
 *     hardcoded field whitelist and hardcodes cp_idx=0 — cp keys can't
 *     reach it at all. This build still never touches cp_idx or
 *     cp{idx}_*: supporting the working half is an operator decision.
 *   - radius_list / RADIUS-Enterprise security editing: always round-tripped
 *     byte-verbatim; a profile with a matching radius_list row refuses
 *     passphrase edits outright (securityUsesRadius in lib/sdn.ts).
 *   - Schedule / timesched editing: round-trips byte-verbatim (never read
 *     into the form, never mutated).
 * Every field not listed as "in scope" above round-trips byte-verbatim from
 * the read, for both the touched profile and every other existing profile —
 * see lib/sdn.ts's module header for exactly how (whole-table rewrite,
 * mirroring sdn.js:12012-12172).
 *
 * ---------------------------------------------------------------------------
 * SAFETY — why this ships structurally inert this session
 * ---------------------------------------------------------------------------
 * confidence.write = 'unverified-write' and writeExclusion = 'wireless'.
 * 'wireless' is one of the five HARD-blocked categories in
 * lib/write-policy.ts: guardedWrite() refuses every write this page can
 * build UNCONDITIONALLY, before it is ever sent, regardless of read-only
 * mode. The brief (§6) could not find a single clean category for SDN
 * writes — they always touch wireless (restart_wireless is the one constant
 * across every native SDN apply) but can also touch DHCP (subnet_rl) and, on
 * paths this build avoids, physical LAN/VLAN — 'wireless' was picked as the
 * closest hard category, which is sufficient given every write this page
 * constructs is refused outright anyway. The read side (confidence.read) is
 * UNCHANGED at 'live-verified' — only the write path is new this session.
 */
import { useCallback, useEffect, useState } from 'react';
import type { Capabilities } from '../../lib/capabilities';
import { hasFlag } from '../../lib/capabilities';
import {
  apPrefixForSdnName,
  BAND_LABEL,
  BAND_ORDER,
  type Band,
  buildCreateGuestProfileWrite,
  buildDeleteGuestProfileWrite,
  buildEditGuestProfileWrite,
  decodeDutListBands,
  fetchGuestProfileApgFields,
  fetchSdnCore,
  fetchSdnWriteSnapshot,
  getGuestProfileSummary,
  isGuestClassSdnName,
  SDN_TYPE_LABEL,
  validateGuestPsk,
  validateGuestSsid,
} from '../../lib/sdn';
import { guardedWrite, isReadOnlyMode, type GuardedWriteOutcome } from '../../lib/write-guard';
import type { PageDef, PageProps } from '../types';
import { Badge, Banner, Button, Card, EmptyState, Loading, Modal, TextInput, Toggle } from '../../ui/components';

interface SdnNetwork {
  idx: string;
  name: string;
  enabled: boolean;
  apgIdx: string;
  ssid: string;
  bands: Set<Band>;
  subnet: string;
  dhcp: string;
  isGuestClass: boolean;
}

async function fetchSdn(): Promise<SdnNetwork[]> {
  const { records, subnetByIdx, apValues } = await fetchSdnCore();
  return records.map((r) => {
    const subnet = subnetByIdx.get(r.subnetIdx);
    const apg = r.apgIdx;
    // MAINFH/MAINBH per-network fields live under apm{idx}_*, not apg{idx}_*
    // (overlapping idx pools — lib/sdn.ts apPrefixForSdnName).
    const prefix = apPrefixForSdnName(r.name);
    return {
      idx: r.idx,
      name: r.name,
      enabled: r.enabled,
      apgIdx: apg,
      ssid: apValues[`${prefix}${apg}_ssid`] ?? '',
      bands: decodeDutListBands(apValues[`${prefix}${apg}_dut_list`]),
      subnet: subnet ? `${subnet[2]}/${subnet[3]}` : '',
      dhcp: subnet ? (subnet[4] === '1' ? `${subnet[5]} – ${subnet[6]}` : 'DHCP off') : '',
      isGuestClass: isGuestClassSdnName(r.name),
    };
  });
}

function bandsLabel(bands: Set<Band>): string {
  const parts = BAND_ORDER.filter((b) => bands.has(b)).map((b) => BAND_LABEL[b]);
  return parts.length > 0 ? parts.join(', ') : '';
}

function bandsEqual(a: Set<Band>, b: Set<Band>): boolean {
  return a.size === b.size && [...a].every((v) => b.has(v));
}

interface GuestFormState {
  ssid: string;
  psk: string;
  enabled: boolean;
  bands: Set<Band>;
}

function OutcomeBanner({ outcome }: { outcome: GuardedWriteOutcome }) {
  return (
    <Banner tone={outcome.blocked ? 'err' : outcome.dryRun ? 'info' : outcome.applied ? 'info' : 'err'}>
      <Badge tone={outcome.blocked ? 'err' : outcome.dryRun ? 'info' : outcome.applied ? 'ok' : 'err'}>
        {outcome.blocked ? 'BLOCKED' : outcome.dryRun ? 'DRY RUN' : outcome.applied ? 'DONE' : 'SENT (unconfirmed)'}
      </Badge>{' '}
      <code>POST {outcome.entry.request.url}</code>
      {outcome.blockedReason && <div>{outcome.blockedReason}</div>}
    </Banner>
  );
}

function GuestProfileModal({
  caps,
  mode,
  idx,
  baseline,
  onClose,
  onSaved,
}: {
  caps: Capabilities;
  mode: 'create' | 'edit';
  idx: string | null;
  baseline: GuestFormState;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<GuestFormState>(baseline);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<GuardedWriteOutcome | null>(null);

  const toggleBand = (b: Band) => {
    setForm((f) => {
      const next = new Set(f.bands);
      if (next.has(b)) next.delete(b);
      else next.add(b);
      return { ...f, bands: next };
    });
  };

  const save = useCallback(async () => {
    setFormError(null);
    setOutcome(null);
    setBusy(true);
    try {
      // Forced-fresh, right here, right before building the payload — never
      // reuse a snapshot from page load. See lib/sdn.ts's staleness warning:
      // a whole-table SDN write built from a stale read silently corrupts
      // every OTHER existing profile, not just the one being touched.
      const snap = await fetchSdnWriteSnapshot(caps);
      const payload =
        mode === 'create'
          ? buildCreateGuestProfileWrite(snap, { ssid: form.ssid, psk: form.psk, enabled: form.enabled, bands: form.bands })
          : await (async () => {
              const summary = getGuestProfileSummary(snap, idx!);
              if (!summary) throw new Error('This profile no longer exists on the router (removed since this page loaded)');
              const currentApg = await fetchGuestProfileApgFields(summary.apgIdx);
              const changed: { ssid?: string; psk?: string; enabled?: boolean; bands?: Set<Band> } = {};
              if (form.ssid !== baseline.ssid) changed.ssid = form.ssid;
              if (form.psk !== '') changed.psk = form.psk;
              if (form.enabled !== baseline.enabled) changed.enabled = form.enabled;
              if (!bandsEqual(form.bands, baseline.bands)) changed.bands = form.bands;
              if (Object.keys(changed).length === 0) throw new Error('No changes to save');
              return buildEditGuestProfileWrite(snap, idx!, currentApg, changed);
            })();
      const result = await guardedWrite(
        {
          endpoint: 'applyapp',
          writeExclusion: 'wireless', // matches this def's writeExclusion — hard-blocked unconditionally
          fields: payload.fields,
          rcService: payload.rcService,
          currentPage: 'SDN.asp',
          // apg{idx}_security is a composite whose fields include the WPA
          // passphrase — redacted from the write log/inspector (the write
          // itself, were this category ever cleared, is unaffected).
          sensitiveKeys: Object.keys(payload.fields).filter((k) => /^apg\d+_security$/.test(k)),
        },
        payload.verify,
      );
      setOutcome(result);
      if (result.applied) onSaved();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [caps, mode, idx, form, baseline, onSaved]);

  const ssidErr = form.ssid ? validateGuestSsid(form.ssid) : null;
  // Blank passphrase means "leave unchanged" in edit mode (never pre-filled
  // with the real PSK — see the module header); it's required in create mode.
  const pskErr = form.psk ? validateGuestPsk(form.psk) : null;
  const canSave =
    !busy &&
    form.bands.size > 0 &&
    !ssidErr &&
    !pskErr &&
    (mode === 'create' ? form.ssid !== '' && form.psk !== '' : true);

  return (
    <Modal
      title={mode === 'create' ? 'New guest network' : `Edit network #${idx}`}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose} disabled={busy}>
            Close
          </Button>
          <Button variant="primary" disabled={!canSave} onClick={() => void save()}>
            {isReadOnlyMode() ? 'Preview save' : 'Save'}
          </Button>
        </>
      }
    >
      {isReadOnlyMode() && (
        <Banner tone="info">Read-only mode: Save previews the exact request without sending it.</Banner>
      )}
      <Banner tone="warn">
        SDN writes are hard-blocked in this build (writeExclusion: wireless) — Save always previews, it can never
        actually reach the router.
      </Banner>
      <div className="mc-row">
        <div className="mc-row__label">SSID</div>
        <div className="mc-row__control">
          <TextInput value={form.ssid} onChange={(v) => setForm((f) => ({ ...f, ssid: v }))} width={260} />
          {ssidErr && form.ssid && <span className="mc-row__error">{ssidErr}</span>}
        </div>
      </div>
      <div className="mc-row">
        <div className="mc-row__label">WPA passphrase{mode === 'edit' && <span className="hint">leave blank to keep current</span>}</div>
        <div className="mc-row__control">
          <TextInput
            value={form.psk}
            onChange={(v) => setForm((f) => ({ ...f, psk: v }))}
            type="text"
            width={260}
            placeholder={mode === 'edit' ? '(unchanged)' : 'MerlinNet-Demo-Passphrase1'}
          />
          {pskErr && form.psk && <span className="mc-row__error">{pskErr}</span>}
        </div>
      </div>
      <div className="mc-row">
        <div className="mc-row__label">Enabled</div>
        <div className="mc-row__control">
          <Toggle on={form.enabled} onChange={(v) => setForm((f) => ({ ...f, enabled: v }))} />
        </div>
      </div>
      <div className="mc-row">
        <div className="mc-row__label">Bands</div>
        <div className="mc-row__control">
          {BAND_ORDER.map((b) => (
            <Badge key={b} tone={form.bands.has(b) ? b : undefined}>
              <button type="button" onClick={() => toggleBand(b)} style={{ all: 'unset', cursor: 'pointer' }}>
                {form.bands.has(b) ? '✓ ' : ''}
                {BAND_LABEL[b]}
              </button>
            </Badge>
          ))}
        </div>
      </div>
      {formError && <Banner tone="err">{formError}</Banner>}
      {outcome && <OutcomeBanner outcome={outcome} />}
    </Modal>
  );
}

function SdnPage(props: PageProps) {
  const { caps } = props;
  const [networks, setNetworks] = useState<SdnNetwork[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<{ mode: 'create' | 'edit'; idx: string | null } | null>(null);
  const [deleteOutcome, setDeleteOutcome] = useState<GuardedWriteOutcome | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const n = await fetchSdn();
      setNetworks(n);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openEdit = (n: SdnNetwork) => setModal({ mode: 'edit', idx: n.idx });
  const openCreate = () => setModal({ mode: 'create', idx: null });

  const deleteNetwork = useCallback(
    async (n: SdnNetwork) => {
      if (!window.confirm(`Delete "${n.ssid || n.name}"? This removes its SSID, subnet, and VLAN records.`)) return;
      setBusy(true);
      setDeleteOutcome(null);
      try {
        const snap = await fetchSdnWriteSnapshot(caps);
        const payload = buildDeleteGuestProfileWrite(snap, n.idx);
        const result = await guardedWrite(
          {
            endpoint: 'applyapp',
            writeExclusion: 'wireless',
            fields: payload.fields,
            rcService: payload.rcService,
            currentPage: 'SDN.asp',
          },
          payload.verify,
        );
        setDeleteOutcome(result);
        if (result.applied) await load();
      } catch (e) {
        setDeleteOutcome(null);
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setBusy(false);
      }
    },
    [caps, load],
  );

  const editingNetwork = modal?.mode === 'edit' ? (networks?.find((n) => n.idx === modal.idx) ?? null) : null;

  return (
    <div>
      <h1 className="mc-page-title">Separate Networks & Guest Wi-Fi</h1>
      <p className="mc-page-subtitle">SDN.asp · Self-Defined Networks</p>
      <Banner tone="info">
        Guest/IoT-class network create, edit (SSID, passphrase, enable, bands) and delete are available below.
        MAINFH/MAINBH (the router&apos;s real broadcast networks) stay read-only. Every write here is hard-blocked
        (writeExclusion: wireless) and can only be previewed, never sent — see this page&apos;s header comment for
        the full scope.
      </Banner>
      {error && <Banner tone="err">Failed to read SDN configuration: {error}</Banner>}
      {deleteOutcome && <OutcomeBanner outcome={deleteOutcome} />}
      {!networks && !error ? (
        <Loading />
      ) : networks ? (
        <Card
          title={`Networks (${networks.length})`}
          badge={
            <Button small variant="primary" disabled={busy} onClick={openCreate}>
              + New guest network
            </Button>
          }
        >
          {networks.length === 0 ? (
            <EmptyState>No self-defined networks configured</EmptyState>
          ) : (
            <table className="mc-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Name</th>
                  <th>SSID</th>
                  <th>State</th>
                  <th>Subnet</th>
                  <th>DHCP pool</th>
                  <th>Bands</th>
                  <th style={{ width: 160 }} />
                </tr>
              </thead>
              <tbody>
                {networks.map((n) => (
                  <tr key={n.idx}>
                    <td>{n.idx}</td>
                    <td>{SDN_TYPE_LABEL[n.name] ?? n.name}</td>
                    <td>{n.ssid || '—'}</td>
                    <td>{n.enabled ? <Badge tone="ok">enabled</Badge> : <Badge>disabled</Badge>}</td>
                    <td className="num">{n.subnet || '—'}</td>
                    <td className="num">{n.dhcp || '—'}</td>
                    <td>{bandsLabel(n.bands) || '—'}</td>
                    <td>
                      {n.isGuestClass ? (
                        <>
                          <Button small disabled={busy} onClick={() => openEdit(n)}>
                            Edit
                          </Button>{' '}
                          <Button small variant="danger" disabled={busy} onClick={() => void deleteNetwork(n)}>
                            Delete
                          </Button>
                        </>
                      ) : (
                        <span className="hint">view-only</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      ) : null}
      {modal?.mode === 'create' && (
        <GuestProfileModal
          caps={caps}
          mode="create"
          idx={null}
          baseline={{ ssid: '', psk: '', enabled: true, bands: new Set<Band>(['24', '5']) }}
          onClose={() => setModal(null)}
          onSaved={() => {
            setModal(null);
            void load();
          }}
        />
      )}
      {modal?.mode === 'edit' && editingNetwork && (
        <GuestProfileModal
          caps={caps}
          mode="edit"
          idx={editingNetwork.idx}
          baseline={{ ssid: editingNetwork.ssid, psk: '', enabled: editingNetwork.enabled, bands: editingNetwork.bands }}
          onClose={() => setModal(null)}
          onSaved={() => {
            setModal(null);
            void load();
          }}
        />
      )}
    </div>
  );
}

export const sdnPages: PageDef[] = [
  {
    kind: 'custom',
    id: 'sdn',
    aspPage: 'SDN.asp',
    title: 'Separate Networks & Guest Wi-Fi',
    navGroup: 'lan',
    navSub: 'segments',
    navOrder: 14,
    confidence: { read: 'live-verified', write: 'unverified-write' },
    writeExclusion: 'wireless',
    gate: (c) => hasFlag(c, 'mtlancfg_support'),
    component: SdnPage,
  },
];
