/**
 * Wake on LAN (Main_WOL_Content.asp). Two halves:
 *  - wollist nvram ('<name>mac' records) edited declaratively via a small
 *    inline list, saved with a plain nvram write (the native page applies it
 *    with no action_script).
 *  - The wake action itself: apply_cgi's SystemCmd branch
 *    (action_mode=' Refresh ', SystemCmd='ether-wake -i br0 -b <MAC>') —
 *    routed through the write-guard like every other router-mutating request,
 *    so read-only mode previews it instead of sending.
 */
import { useCallback, useEffect, useState } from 'react';
import { nvramCharToAscii } from '../../lib/router-io';
import { guardedWrite, isReadOnlyMode, type GuardedWriteOutcome } from '../../lib/write-guard';
import { parseRuleList, serializeRuleList } from '../../lib/rulelist';
import type { ListSpec, PageDef, PageProps } from '../types';
import { Badge, Banner, Button, Card, EmptyState, Loading, TextInput } from '../../ui/components';

const MAC_PATTERN = /^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$/;
const WOL_SPEC: ListSpec = { columns: [{ id: 'name', label: 'Name' }, { id: 'mac', label: 'MAC' }] };

function WolPage(_props: PageProps) {
  const [entries, setEntries] = useState<string[][] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [baseline, setBaseline] = useState('');
  const [manualMac, setManualMac] = useState('');
  const [draft, setDraft] = useState<{ name: string; mac: string } | null>(null);
  const [outcome, setOutcome] = useState<GuardedWriteOutcome | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const v = await nvramCharToAscii(['wollist']);
      setBaseline(v.wollist);
      setEntries(parseRuleList(v.wollist, WOL_SPEC));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const wake = useCallback(
    async (mac: string) => {
      setBusy(true);
      try {
        const result = await guardedWrite(
          {
            endpoint: 'applyapp',
            actionMode: ' Refresh ',
            fields: { SystemCmd: `ether-wake -i br0 -b ${mac}` },
            currentPage: 'Main_WOL_Content.asp',
          },
          null,
        );
        setOutcome(result);
      } finally {
        setBusy(false);
      }
    },
    [],
  );

  const saveList = useCallback(
    async (next: string[][]) => {
      setBusy(true);
      try {
        const serialized = serializeRuleList(next, WOL_SPEC);
        const result = await guardedWrite(
          { endpoint: 'applyapp', fields: { wollist: serialized }, currentPage: 'Main_WOL_Content.asp' },
          { wollist: serialized },
        );
        setOutcome(result);
        if (result.applied) await load();
      } finally {
        setBusy(false);
      }
    },
    [load],
  );

  if (error) return <Banner tone="err">Failed to read WOL list: {error}</Banner>;
  if (!entries) return <Loading />;

  const dirty = serializeRuleList(entries, WOL_SPEC) !== baseline;

  return (
    <div>
      <h1 className="mc-page-title">Wake on LAN</h1>
      <p className="mc-page-subtitle">Main_WOL_Content.asp</p>
      {isReadOnlyMode() && (
        <Banner tone="info">Read-only mode: Wake and Save preview the exact request without sending it.</Banner>
      )}
      <Card title="Quick wake">
        <div className="mc-row">
          <div className="mc-row__label">Target MAC address</div>
          <div className="mc-row__control">
            <TextInput value={manualMac} onChange={setManualMac} placeholder="AA:BB:CC:DD:EE:FF" width={220} />
            <Button
              variant="primary"
              disabled={busy || !MAC_PATTERN.test(manualMac)}
              onClick={() => void wake(manualMac)}
            >
              Wake
            </Button>
          </div>
        </div>
      </Card>
      <Card title={`Saved targets (${entries.length})`}>
        {entries.length === 0 && !draft ? (
          <EmptyState>No saved WOL targets</EmptyState>
        ) : (
          <table className="mc-table mc-table--mono">
            <thead>
              <tr>
                <th>Name</th>
                <th>MAC address</th>
                <th style={{ width: 160 }} />
              </tr>
            </thead>
            <tbody>
              {entries.map((row, i) => (
                <tr key={i}>
                  <td>{row[0]}</td>
                  <td>{row[1]}</td>
                  <td>
                    <Button small disabled={busy} onClick={() => void wake(row[1])}>
                      Wake
                    </Button>{' '}
                    <Button small disabled={busy} onClick={() => setEntries(entries.filter((_, j) => j !== i))}>
                      Remove
                    </Button>
                  </td>
                </tr>
              ))}
              {draft && (
                <tr>
                  <td>
                    <TextInput value={draft.name} onChange={(v) => setDraft({ ...draft, name: v })} width={160} />
                  </td>
                  <td>
                    <TextInput value={draft.mac} onChange={(v) => setDraft({ ...draft, mac: v })} width={190} />
                  </td>
                  <td>
                    <Button
                      small
                      variant="primary"
                      disabled={!draft.name || !MAC_PATTERN.test(draft.mac)}
                      onClick={() => {
                        setEntries([...entries, [draft.name, draft.mac]]);
                        setDraft(null);
                      }}
                    >
                      Add
                    </Button>{' '}
                    <Button small onClick={() => setDraft(null)}>
                      Cancel
                    </Button>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
        <div className="mc-listedit__bar">
          {!draft && (
            <Button small onClick={() => setDraft({ name: '', mac: '' })}>
              + Add target
            </Button>
          )}
          {dirty && (
            <>
              <Button small variant="primary" disabled={busy} onClick={() => void saveList(entries)}>
                {isReadOnlyMode() ? 'Preview save' : 'Save list'}
              </Button>
              <Button small disabled={busy} onClick={() => void load()}>
                Revert
              </Button>
            </>
          )}
        </div>
      </Card>
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

export const wolPages: PageDef[] = [
  {
    kind: 'custom',
    id: 'wol',
    aspPage: 'Main_WOL_Content.asp',
    title: 'Wake on LAN',
    navGroup: 'nettools',
    confidence: { read: 'structural', write: 'unverified-write' },
    writeExclusion: null,
    component: WolPage,
  },
];
