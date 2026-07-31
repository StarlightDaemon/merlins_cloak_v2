/**
 * Certificate / key BLOB handling — two pages, two writeExclusion tags.
 *
 * Source: RESEARCH BRIEF `research/07-cert-blob.md` (RAW/merlin/release/src/
 * router/{www,httpd,shared}, read-only firmware source survey, no router
 * contact). Every web.c / defaults.c / .asp line cited below is a citation
 * from that brief, not a fresh re-derivation.
 *
 * =====================================================================
 * PRIVACY / KEY-MATERIAL RULES — read before touching this file
 * =====================================================================
 * Private-key material read FROM the router (OpenVPN vpn_crt_*_key content,
 * WireGuard wgs_priv/wgc{n}_priv) is NEVER put into React state, the DOM, a
 * console.log/log.* call, or the write-guard diagnostics log. Every read
 * helper below that touches such a field reduces it to a presence boolean
 * (or, for the router's own leaf cert, to the parsed subject/issuer/date
 * metadata httpd_cert_info already emits — never raw PEM) inside the async
 * function itself; the actual bytes never escape that function's local
 * scope. Public-cert metadata (subject/issuer/dates) is fine to render.
 *
 * NEW material a user pastes/selects (the OpenVPN textarea-replace flow on
 * Page 2) is held in ordinary component state ONLY for the duration of
 * constructing the write request, is never persisted to extension storage
 * or logged, and is cleared immediately on submit and on unmount.
 *
 * All example/placeholder strings in comments use an obviously-fake marker
 * ("-----BEGIN FAKE DEMO KEY-----") — never real PEM.
 *
 * =====================================================================
 * WHY THERE IS NO FILE-UPLOAD (multipart) WRITE IN EITHER PAGE
 * =====================================================================
 * Three native surfaces are genuine multipart/form-data uploads:
 *   - upload_cert_key.cgi (router HTTPS cert+key, web.c:17096-17283, fields
 *     file_key/file_cert)
 *   - upload_wgc_config.cgi (WireGuard client .conf, web.c:26850-26988)
 *   - vpnupload.cgi / upload_server_ovpn_cert.cgi (OpenVPN client key
 *     supplementation / server cert import; the latter has no confirmed
 *     native UI caller in this firmware build per the brief)
 *
 * The write chokepoint (lib/write-guard.ts guardedWrite -> lib/router-io.ts
 * buildWriteRequest/submitBuiltWrite) is string-body-only by construction:
 * WriteSpec.fields is Record<string,string>, buildWriteRequest always
 * produces a URLSearchParams-encoded `body: string`
 * (BuiltWriteRequest.body: string), and guardedWrite logs that body verbatim
 * on submit (`log.info('submitting write', request.url, request.body)`) and
 * stores it in the in-memory write log that the Diagnostics page renders
 * directly (`{e.request.body}`, pages/defs/extension.tsx). For a cert/key
 * upload, "the body" IS the private key: routing a real multipart request
 * through this chokepoint unmodified is impossible (FormData is not a
 * string), and widening it to accept one would put raw key material into
 * the console and the on-screen write log — a direct violation of the
 * privacy rule above. Fixing that would mean changing write-guard.ts's
 * logging/storage semantics and/or the Diagnostics render path, both
 * explicitly out of scope for this change. So: no multipart helper was
 * added to router-io.ts, no file-upload UI exists on either page below, and
 * this is a documented descope, not a bypass of the guard — per the task's
 * own instruction, "ship the READ surfaces + textarea-paste write only" is
 * exactly what follows. Operators use the router's native pages for any
 * cert/key upload until a multipart-safe path exists.
 *
 * =====================================================================
 * PAGE 1 — 'router-cert' (writeExclusion: 'restricted-misc')
 * =====================================================================
 * READ: `httpd_cert_info` ej hook (registered web.c:42376, implementation
 * `ej_httpd_cert_info` web.c:38212-38330) — opens the active cert (branch on
 * le_enable: 0=self-signed HTTPD_GEN_CERT, 1=Let's Encrypt
 * get_path_le_domain_cert(), 2=uploaded UPLOAD_CACERT+UPLOAD_CAKEY else
 * UPLOAD_CERT+UPLOAD_KEY; web.c:38226-38246) and emits ONLY parsed metadata:
 * issueTo/issueBy/from/expire (leaf) and CAissueTo/CAissueBy/CAfrom/CAexpire
 * (uploaded CA chain, when present) — never raw PEM, never a fingerprint
 * hash. Plus `le_enable` (defaults.c:4786; 0/1/2 = self-signed/LE/uploaded —
 * this IS the mode selector) and `le_state` (defaults.c:7265, backend-
 * written status code, read-only in practice) via plain nvram_get.
 *
 * WRITE: see "why there is no file-upload write" above — descoped. The
 * on-page notice repeats the brief's finding that `do_upload_cert_key`'s own
 * validation is a marker-string scan only (`"END RSA PRIVATE KEY"` /
 * `"END CERTIFICATE"`, web.c:589-590) with NO cryptographic key/cert
 * pair-match check — a bad or mismatched pair can leave the HTTPS UI
 * presenting an untrusted/unusable certificate, locking the operator out
 * until it's reset via some other access path (native `clear_file.cgi?
 * clear_file_name=server_certs`, web.c:17934-17993, itself out of scope
 * here). This is exactly the risk class `restricted-misc` exists to flag.
 *
 * OUT OF SCOPE (documented, not modeled):
 *  - le_enable editing: switching it fires restart_ddns_le/prepare_cert and
 *    interacts with the whole DDNS state machine (le_acme_* tuning knobs,
 *    hostname/port-forward prerequisites) — a different feature area.
 *  - le_acme_* ACME tuning knobs, and the LE-issued cert's own content
 *    (flows through the same httpd_cert_info hook when le_enable==1, no
 *    separate surface).
 *  - Reset-to-self-signed (`clear_file.cgi?clear_file_name=...`) and the
 *    four download endpoints (cacert_key.tar/cert_key.tar/cert.tar/direct
 *    cacert stream, web.c:17287-17365) — read-only export / destructive
 *    reset actions, not modeled by this pass.
 *
 * =====================================================================
 * PAGE 2 — 'vpn-certs' (writeExclusion: 'vpn', hard-blocked)
 * =====================================================================
 * READ:
 *  - OpenVPN server (1-2) / client (1-5) cert & key PRESENCE, one field at a
 *    time: ca/crt/key/dh/crl/extra (the task's explicit field list; the
 *    brief's write-path citation also shows a `static` field —
 *    tls-auth/tls-crypt pre-shared key — intentionally NOT modeled here to
 *    match the given read scope and keep read/write symmetric). Source:
 *    `/ajax_openvpn_server.asp` (`<% vpn_crt_client(); %> <% vpn_crt_server();
 *    %>`) -> ej hooks `vpn_crt_server`/`vpn_crt_client` (web.c:42244-42245,
 *    impl web.c:3139-3203) -> shared helper `_get_vpn_crt_value`
 *    (web.c:3112-3137) -> `get_ovpn_key()` (jffs-backed; NOT plain nvram —
 *    confirmed absent from defaults.c). The endpoint hands back up to 8000
 *    bytes of PEM per field as a `var vpn_crt_server1_ca = ['...'];`
 *    HTML-entity-encoded JS literal; `presenceOfVar` below reads exactly one
 *    character past the opening quote (empty-string sentinel vs. real
 *    content) to decide presence and never retains the fetched text beyond
 *    that function call. Shown uniformly present/absent for every slot x
 *    field combination, including semantically-inapplicable ones (e.g. `dh`
 *    on a client slot) — matches the task's "keep it uniform and safe"
 *    instruction rather than trying to be clever about which cells can
 *    exist.
 *  - WireGuard `wgs_priv` / `wgc{1-5}_priv`: plain literal nvram
 *    (defaults.c:5424, :5452) — confirmed NOT file-backed, and (unlike
 *    OpenVPN) the native page puts the actual value straight into a
 *    same-origin `<input>`'s DOM value
 *    (Advanced_WireguardClient_Content.asp:663). This page never does that:
 *    presence only, computed the same discard-immediately way as the
 *    OpenVPN fields above.
 *  - IPSec server cert: read-only status line from `ipsec_cert_info.cgi`
 *    (web.c:28479, impl `do_ipsec_cert_info_cgi` web.c:18240-18292) — same
 *    metadata-only shape as httpd_cert_info, plus an `update_state` flag
 *    (stale-vs-DDNS-hostname check). Cheap (one GET), so included per the
 *    task's "if cheaply derivable" instruction; fetch failures are swallowed
 *    and the row is simply omitted (older firmware / IPSec not built in).
 *
 * WRITE: textarea paste-replace for one OpenVPN slot+field at a time,
 * through the *normal* applyapp guarded path (urlencoded, fits the existing
 * string-body chokepoint fine) — mirroring the native `save_keys()`
 * (Advanced_VPN_OpenVPN.asp:1140-1170) textarea-to-hidden-field copy that
 * rides the standard `/start_apply.htm`/`applyapp.cgi` -> `validate_apply`
 * pipeline, where these specific field-name prefixes are special-cased to
 * `set_ovpn_key()` instead of `nvram_set()` (web.c:4595 server branch,
 * :4636 client branch; the unit-indexed defaulting counterpart lives in
 * `validate_instance` at web.c:4059-4153). The posted field name itself is
 * UNINDEXED (`vpn_crt_server_ca`, not `vpn_crt_server1_ca` — confirmed
 * literal prefix at web.c:4595) guarded by `unit!=-1`; this build submits a
 * companion `unit` field alongside it to select the slot, inferred from that
 * `unit!=-1` precondition and the standard multi-instance form convention
 * elsewhere in web.c — the brief does not independently confirm the
 * companion field's exact name, so treat this as best-current-understanding,
 * not a verified wire format (confidence is 'unverified-write' precisely
 * because of gaps like this one). `writeExclusion: 'vpn'` means every
 * submission from this page is refused unconditionally by guardedWrite
 * before it ever reaches the network, per lib/write-policy.ts's hard
 * exclusion list — this UI exists to preview the exact request, not to
 * change a live router in this build.
 *
 * OUT OF SCOPE (documented, not modeled):
 *  - `static` (tls-auth/tls-crypt PSK) field — see READ note above.
 *  - WireGuard `.conf` import (`upload_wgc_config.cgi`) — multipart, see the
 *    file-level "why no upload" note; deferred alongside Page 1's upload.
 *  - `vpnupload.cgi` (OpenVPN client key supplementation / `.ovpn` import)
 *    and `upload_server_ovpn_cert.cgi` (server cert import, no confirmed
 *    native UI caller per the brief) — both multipart, both deferred; the
 *    latter additionally unverified to have any live UI trigger at all.
 *  - `upload_server_ipsec_cert.cgi` — multipart, AND the brief found no
 *    referencing `.asp`/JS anywhere in the native `www/` tree (UI-orphaned
 *    or gated behind a sysdep variant not in the snapshot) — not built
 *    against without a live-firmware confirmation of what, if anything,
 *    calls it.
 *  - IKEv2 cert renew/download (`renew_ikev2_cert_key.cgi`,
 *    `ikev2_cert_windows.der`/`ikev2_cert_mobile.pem`) — DDNS-hostname-
 *    derived regeneration and raw downloads, different feature shape than
 *    "edit this blob"; not modeled.
 */
import { useCallback, useEffect, useState } from 'react';
import { hasFlag } from '../../lib/capabilities';
import { fetchRouterText, hookGet, nvramGet } from '../../lib/router-io';
import { guardedWrite, isReadOnlyMode, type GuardedWriteOutcome } from '../../lib/write-guard';
import type { PageDef, PageProps } from '../types';
import { Badge, Banner, Button, Card, Select } from '../../ui/components';

function asStr(v: unknown): string {
  return typeof v === 'string' ? v : v == null ? '' : String(v);
}

// ===========================================================================
// Page 1 — router-cert
// ===========================================================================

interface HttpdCertInfo {
  issueTo: string;
  issueBy: string;
  from: string;
  expire: string;
  CAissueTo: string;
  CAissueBy: string;
  CAfrom: string;
  CAexpire: string;
}

/** httpd_cert_info ej hook — metadata only, never raw PEM (see header). */
async function fetchHttpdCertInfo(): Promise<HttpdCertInfo> {
  const raw = await hookGet('httpd_cert_info()');
  const o = (raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}) as Record<string, unknown>;
  return {
    issueTo: asStr(o.issueTo),
    issueBy: asStr(o.issueBy),
    from: asStr(o.from),
    expire: asStr(o.expire),
    CAissueTo: asStr(o.CAissueTo),
    CAissueBy: asStr(o.CAissueBy),
    CAfrom: asStr(o.CAfrom),
    CAexpire: asStr(o.CAexpire),
  };
}

function certMode(leEnable: string): { label: string; tone: 'ok' | 'info' } {
  switch (leEnable) {
    case '1':
      return { label: "Let's Encrypt", tone: 'ok' };
    case '2':
      return { label: 'Imported (uploaded)', tone: 'info' };
    default:
      return { label: 'Self-signed (auto-generated)', tone: 'info' };
  }
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <tr>
      <td>{label}</td>
      <td>{value || '—'}</td>
    </tr>
  );
}

function RouterCertPage(_props: PageProps) {
  const [info, setInfo] = useState<HttpdCertInfo | null>(null);
  const [leEnable, setLeEnable] = useState('');
  const [leState, setLeState] = useState('');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [ci, nv] = await Promise.all([fetchHttpdCertInfo(), nvramGet(['le_enable', 'le_state'])]);
      setInfo(ci);
      setLeEnable(nv.le_enable ?? '');
      setLeState(nv.le_state ?? '');
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const mode = certMode(leEnable);
  const hasCaChain = !!(info && (info.CAissueTo || info.CAissueBy));

  return (
    <div>
      <h1 className="mc-page-title">Router HTTPS Certificate</h1>
      <p className="mc-page-subtitle">Advanced_ASUSDDNS_Content.asp (cert panel) · Merlin</p>

      <Banner tone="warn">
        Certificate/key upload is not implemented in this build (see this page&apos;s Upload card below for
        why). Use the router&apos;s own web UI — WAN → DDNS page — for uploads until a safe path exists here.
      </Banner>

      {error && <Banner tone="err">Failed to read certificate status: {error}</Banner>}

      <Card title="Status" badge={<Badge tone={mode.tone}>{mode.label}</Badge>}>
        {!info ? (
          <p>Reading…</p>
        ) : (
          <>
            <table className="mc-table">
              <tbody>
                <MetaRow label="Subject (CN)" value={info.issueTo} />
                <MetaRow label="Issuer (CN)" value={info.issueBy} />
                <MetaRow label="Valid from" value={info.from} />
                <MetaRow label="Valid until" value={info.expire} />
              </tbody>
            </table>
            {hasCaChain && (
              <>
                <p>Uploaded root/intermediate CA (signs the served leaf certificate):</p>
                <table className="mc-table">
                  <tbody>
                    <MetaRow label="CA subject (CN)" value={info.CAissueTo} />
                    <MetaRow label="CA issuer (CN)" value={info.CAissueBy} />
                    <MetaRow label="CA valid from" value={info.CAfrom} />
                    <MetaRow label="CA valid until" value={info.CAexpire} />
                  </tbody>
                </table>
              </>
            )}
          </>
        )}
      </Card>

      <Card
        title="Let's Encrypt state"
        note="le_enable / le_state, read-only here — editing le_enable is out of scope (see header comment: it drives the DDNS/ACME state machine, a different feature area)."
      >
        <table className="mc-table">
          <tbody>
            <MetaRow label="le_enable" value={leEnable ? `${leEnable} (${mode.label})` : ''} />
            <MetaRow label="le_state" value={leState} />
          </tbody>
        </table>
      </Card>

      <Card title="Upload cert/key (not implemented)">
        <p>
          Native path: a two-file <code>multipart/form-data</code> POST to{' '}
          <code>upload_cert_key.cgi</code> (fields <code>file_key</code> / <code>file_cert</code>). This
          extension&apos;s write chokepoint only builds and logs urlencoded string bodies — see the file
          header for the specific reasons a multipart body can&apos;t be added without changing
          write-guard.ts / the Diagnostics log renderer, both off-limits for this change. Deferred, not
          bypassed.
        </p>
        <p>
          Even once wired up: the router&apos;s own validation is a marker-string scan only (
          <code>&quot;END RSA PRIVATE KEY&quot;</code> / <code>&quot;END CERTIFICATE&quot;</code>) — it does{' '}
          <strong>not</strong> verify the key actually matches the certificate. A bad or mismatched pair can
          leave the HTTPS UI presenting an untrusted/unusable certificate — locking the operator out until
          it&apos;s reset through some other access path. That risk is why this page is tagged{' '}
          <code>restricted-misc</code>.
        </p>
      </Card>
    </div>
  );
}

// ===========================================================================
// Page 2 — vpn-certs
// ===========================================================================

const OV_FIELDS = ['ca', 'crt', 'key', 'dh', 'crl', 'extra'] as const;
type OvField = (typeof OV_FIELDS)[number];
const OV_FIELD_LABELS: Record<OvField, string> = {
  ca: 'CA cert',
  crt: 'Certificate',
  key: 'Private key',
  dh: 'DH params',
  crl: 'CRL',
  extra: 'Extra/custom',
};

interface OvSlot {
  kind: 'server' | 'client';
  unit: number;
}

const OV_SERVER_SLOTS: OvSlot[] = [1, 2].map((unit) => ({ kind: 'server', unit }));
const OV_CLIENT_SLOTS: OvSlot[] = [1, 2, 3, 4, 5].map((unit) => ({ kind: 'client', unit }));

/**
 * Presence-only check against one `name = ['<content>'...` (or `"..."`) JS
 * literal in raw hook text. Reads exactly one character past the opening
 * quote — enough to tell "empty sentinel" from "real content" — and never
 * touches, returns, or retains the rest of the field's content. `text` (the
 * full response, which DOES contain real key material for populated slots)
 * lives only in the caller's local scope and is discarded when it returns.
 */
function presenceOfVar(text: string, varName: string): boolean {
  const re = new RegExp(`${varName}\\s*=\\s*\\[\\s*(['"])`);
  const m = re.exec(text);
  if (!m) return false;
  const quote = m[1];
  const nextChar = text[m.index + m[0].length];
  return nextChar !== undefined && nextChar !== quote;
}

/**
 * OpenVPN cert/key slot presence, one boolean per slot x field. Fetches the
 * same side-channel the native Keys&Cert panel polls
 * (`updateCRTValue()`, Advanced_VPN_OpenVPN.asp:987-1029) directly rather
 * than through appGet.cgi, matching the confirmed native fetch shape.
 */
async function fetchOpenvpnCrtPresence(): Promise<Record<string, boolean>> {
  const text = await fetchRouterText('/ajax_openvpn_server.asp');
  const out: Record<string, boolean> = {};
  for (const slot of [...OV_SERVER_SLOTS, ...OV_CLIENT_SLOTS]) {
    for (const field of OV_FIELDS) {
      const varName = `vpn_crt_${slot.kind}${slot.unit}_${field}`;
      out[varName] = presenceOfVar(text, varName);
    }
  }
  return out;
}

/**
 * WireGuard private-key presence. wgs_priv/wgc{n}_priv are plain literal
 * nvram (unlike OpenVPN's jffs-backed fields) — nvramGet necessarily reads
 * the actual value into `raw` here, but this function reduces it to a
 * boolean before returning and never assigns the raw string anywhere else.
 */
async function fetchWireguardKeyPresence(): Promise<Record<string, boolean>> {
  const keys = ['wgs_priv', ...[1, 2, 3, 4, 5].map((n) => `wgc${n}_priv`)];
  const raw = await nvramGet(keys);
  const out: Record<string, boolean> = {};
  for (const k of keys) out[k] = !!raw[k];
  return out;
}

interface IpsecCertInfo {
  issueTo: string;
  issueBy: string;
  from: string;
  expire: string;
  updateState: string;
}

/** ipsec_cert_info.cgi — metadata-only JSON, same shape as httpd_cert_info. */
async function fetchIpsecCertInfo(): Promise<IpsecCertInfo | null> {
  try {
    const text = await fetchRouterText('/ipsec_cert_info.cgi');
    const o = JSON.parse(text.trim()) as Record<string, unknown>;
    return {
      issueTo: asStr(o.issueTo),
      issueBy: asStr(o.issueBy),
      from: asStr(o.from),
      expire: asStr(o.expire),
      updateState: asStr(o.update_state),
    };
  } catch {
    // Absent on older firmware / IPSec not built in this image — omit the row.
    return null;
  }
}

function PresenceBadge({ present }: { present: boolean }) {
  return <Badge tone={present ? 'ok' : 'info'}>{present ? 'present' : 'absent'}</Badge>;
}

function OvPresenceTable({ slots, presence }: { slots: OvSlot[]; presence: Record<string, boolean> }) {
  return (
    <table className="mc-table">
      <thead>
        <tr>
          <th>Slot</th>
          {OV_FIELDS.map((f) => (
            <th key={f}>{OV_FIELD_LABELS[f]}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {slots.map((slot) => (
          <tr key={`${slot.kind}${slot.unit}`}>
            <td>
              {slot.kind === 'server' ? 'Server' : 'Client'} {slot.unit}
            </td>
            {OV_FIELDS.map((f) => (
              <td key={f}>
                <PresenceBadge present={!!presence[`vpn_crt_${slot.kind}${slot.unit}_${f}`]} />
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function VpnCertsPage({ caps }: PageProps) {
  const showOpenvpn = hasFlag(caps, 'openvpnd_support');
  const showWireguard = hasFlag(caps, 'wireguard_support');
  const showIpsec = hasFlag(caps, 'ipsec_srv_support');

  const [ovPresence, setOvPresence] = useState<Record<string, boolean> | null>(null);
  const [wgPresence, setWgPresence] = useState<Record<string, boolean> | null>(null);
  const [ipsecInfo, setIpsecInfo] = useState<IpsecCertInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [ov, wg, ipsec] = await Promise.all([
        showOpenvpn ? fetchOpenvpnCrtPresence() : Promise.resolve(null),
        showWireguard ? fetchWireguardKeyPresence() : Promise.resolve(null),
        showIpsec ? fetchIpsecCertInfo() : Promise.resolve(null),
      ]);
      setOvPresence(ov);
      setWgPresence(wg);
      setIpsecInfo(ipsec);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [showOpenvpn, showWireguard, showIpsec]);

  useEffect(() => {
    void load();
  }, [load]);

  // OpenVPN textarea paste-replace write.
  const [ovType, setOvType] = useState<'server' | 'client'>('server');
  const [ovUnit, setOvUnit] = useState('1');
  const [ovField, setOvField] = useState<OvField>('ca');
  const [ovText, setOvText] = useState('');
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<GuardedWriteOutcome | null>(null);

  // Never let pasted key/cert material outlive this component.
  useEffect(() => () => setOvText(''), []);

  const unitOptions = (ovType === 'server' ? OV_SERVER_SLOTS : OV_CLIENT_SLOTS).map((s) => ({
    value: String(s.unit),
    label: `${s.kind === 'server' ? 'Server' : 'Client'} ${s.unit}`,
  }));

  const submitOv = useCallback(async () => {
    setBusy(true);
    try {
      // Unindexed field name + companion `unit` field — see header comment
      // "WRITE:" for the web.c citation and the inference this rests on.
      const fieldName = `vpn_crt_${ovType}_${ovField}`;
      const result = await guardedWrite(
        {
          endpoint: 'applyapp',
          writeExclusion: 'vpn', // hard-excluded: guardedWrite refuses this unconditionally
          fields: { unit: ovUnit, [fieldName]: ovText },
          currentPage: 'Advanced_VPN_OpenVPN.asp',
          // Pasted key/cert material must never reach the write log — even a
          // hard-excluded dry-run records the constructed request there.
          sensitiveKeys: [fieldName],
        },
        // Lands in a jffs file via set_ovpn_key(), not plain nvram — nothing
        // to forced-fresh-read-confirm even if this category were ever
        // cleared, so no verifyKeys.
        null,
      );
      setOutcome(result);
    } finally {
      setOvText('');
      setBusy(false);
    }
  }, [ovType, ovUnit, ovField, ovText]);

  return (
    <div>
      <h1 className="mc-page-title">VPN Certificates &amp; Keys</h1>
      <p className="mc-page-subtitle">
        ajax_openvpn_server.asp / wgs_priv+wgc*_priv / ipsec_cert_info.cgi · Merlin
      </p>

      <Banner tone="warn">
        Every write on this page is refused unconditionally (writeExclusion &quot;vpn&quot; is hard-excluded)
        — the Apply button below always previews the exact request instead of sending it. File uploads
        (OpenVPN client key/.ovpn import, WireGuard .conf import, server cert import) are not implemented at
        all in this build; see the file header for why.
      </Banner>

      {error && <Banner tone="err">Failed to read certificate/key presence: {error}</Banner>}

      {showOpenvpn && (
        <Card title="OpenVPN — server keys &amp; certs">
          {!ovPresence ? <p>Reading…</p> : <OvPresenceTable slots={OV_SERVER_SLOTS} presence={ovPresence} />}
        </Card>
      )}
      {showOpenvpn && (
        <Card title="OpenVPN — client keys &amp; certs">
          {!ovPresence ? <p>Reading…</p> : <OvPresenceTable slots={OV_CLIENT_SLOTS} presence={ovPresence} />}
        </Card>
      )}

      {showOpenvpn && (
        <Card title="Replace one OpenVPN field (paste)">
          {isReadOnlyMode() && (
            <Banner tone="info">
              Read-only mode: Apply previews the exact request without sending it. This category is
              hard-excluded regardless, so it never sends either way.
            </Banner>
          )}
          <div className="mc-row">
            <div className="mc-row__label">Slot</div>
            <div className="mc-row__control">
              <Select
                value={ovType}
                onChange={(v) => {
                  setOvType(v as 'server' | 'client');
                  setOvUnit('1');
                }}
                options={[
                  { value: 'server', label: 'Server' },
                  { value: 'client', label: 'Client' },
                ]}
              />
              <Select value={ovUnit} onChange={setOvUnit} options={unitOptions} />
              <Select
                value={ovField}
                onChange={(v) => setOvField(v as OvField)}
                options={OV_FIELDS.map((f) => ({ value: f, label: OV_FIELD_LABELS[f] }))}
              />
            </div>
          </div>
          <textarea
            className="mc-textarea"
            spellCheck={false}
            placeholder={'-----BEGIN FAKE DEMO KEY-----\n…\n-----END FAKE DEMO KEY-----'}
            value={ovText}
            onChange={(e) => setOvText(e.target.value)}
          />
          <p>
            Pasted content stays in this page&apos;s memory only until you click Apply (or navigate away) —
            never saved, never logged. The router performs no client/server cert-key pair-match validation
            on this path either (same caveat as Page 1&apos;s upload).
          </p>
          <Button
            variant="primary"
            disabled={busy || !ovText}
            onClick={() => {
              void submitOv();
            }}
          >
            {isReadOnlyMode() ? 'Preview Apply' : 'Apply'}
          </Button>
          {outcome && (
            <Banner tone={outcome.blocked ? 'warn' : outcome.dryRun ? 'info' : outcome.applied ? 'info' : 'err'}>
              <Badge tone={outcome.blocked ? 'warn' : outcome.dryRun ? 'info' : outcome.applied ? 'ok' : 'err'}>
                {outcome.blocked ? 'BLOCKED' : outcome.dryRun ? 'DRY RUN' : outcome.applied ? 'DONE' : 'SENT (unconfirmed)'}
              </Badge>{' '}
              {outcome.blockedReason ?? (
                <>
                  <code>POST {outcome.entry.request.url}</code> · field <code>{outcome.entry.request.body.split('&')[0]}</code>…
                </>
              )}
            </Banner>
          )}
        </Card>
      )}

      {showWireguard && (
        <Card title="WireGuard — private key presence" note="Values are never displayed here, only whether one is set.">
          <table className="mc-table">
            <tbody>
              <tr>
                <td>Server (wgs_priv)</td>
                <td>
                  <PresenceBadge present={!!wgPresence?.wgs_priv} />
                </td>
              </tr>
              {[1, 2, 3, 4, 5].map((n) => (
                <tr key={n}>
                  <td>Client {n} (wgc{n}_priv)</td>
                  <td>
                    <PresenceBadge present={!!wgPresence?.[`wgc${n}_priv`]} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {showIpsec && ipsecInfo && (
        <Card title="IPSec server certificate">
          <table className="mc-table">
            <tbody>
              <MetaRow label="Subject (CN)" value={ipsecInfo.issueTo} />
              <MetaRow label="Issuer (CN)" value={ipsecInfo.issueBy} />
              <MetaRow label="Valid from" value={ipsecInfo.from} />
              <MetaRow label="Valid until" value={ipsecInfo.expire} />
              <MetaRow label="Stale vs. current DDNS host" value={ipsecInfo.updateState === '1' ? 'yes' : 'no'} />
            </tbody>
          </table>
        </Card>
      )}

      <Card title="Deferred / out of scope">
        <ul>
          <li>OpenVPN tls-auth/tls-crypt &quot;static&quot; key field — not read or written here.</li>
          <li>WireGuard client .conf import (upload_wgc_config.cgi) — multipart, deferred.</li>
          <li>OpenVPN vpnupload.cgi (client key/.ovpn import) — multipart, deferred.</li>
          <li>OpenVPN upload_server_ovpn_cert.cgi — multipart, deferred; no confirmed native UI caller either.</li>
          <li>IPSec upload_server_ipsec_cert.cgi — multipart, deferred; no native UI caller found at all.</li>
          <li>IKEv2 cert renew/download — different feature shape (DDNS-derived regen / raw download), not modeled.</li>
        </ul>
      </Card>
    </div>
  );
}

// ===========================================================================
// Registration
// ===========================================================================

export const certificatePages: PageDef[] = [
  {
    kind: 'custom',
    id: 'router-cert',
    aspPage: 'Advanced_ASUSDDNS_Content.asp',
    title: 'Router HTTPS Certificate',
    navGroup: 'admin',
    navSub: 'access',
    navOrder: 65.5,
    confidence: { read: 'structural', write: 'unverified-write' },
    writeExclusion: 'restricted-misc',
    component: RouterCertPage,
  },
  {
    kind: 'custom',
    id: 'vpn-certs',
    aspPage: 'Advanced_VPN_OpenVPN.asp',
    title: 'VPN Certificates & Keys',
    navGroup: 'vpn',
    navSub: 'overview',
    navOrder: 33.5,
    merlinOnly: true,
    gate: (c) => hasFlag(c, 'openvpnd_support') || hasFlag(c, 'wireguard_support'),
    confidence: { read: 'structural', write: 'unverified-write' },
    writeExclusion: 'vpn',
    component: VpnCertsPage,
  },
];
