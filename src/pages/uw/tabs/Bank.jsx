import React, { useEffect, useState } from 'react';
import { Plus, Trash2, Upload as UploadIcon } from 'lucide-react';
import { uw } from '../../../api.js';
import { Card, Chip, Empty, ErrorNote, Field, Modal, Spinner, Table, Td } from '../../../ui.jsx';
import { useLoad } from '../../../hooks.js';
import { label, rupees } from '../../../uwFormat.js';
import { useAction } from './common.jsx';

export default function Bank({ id, meta, editable, refresh, tick }) {
  const { data: b, reload } = useLoad(() => uw.bank(id), [id, tick]);
  const [adding, setAdding] = useState(false);
  const [importing, setImporting] = useState(false);
  const [ack, setAck] = useState(null);
  const [busy, run] = useAction(() => { reload(); refresh(); });
  if (!b) return <Card><Spinner /></Card>;
  const t = b.totals;

  return (
    <div className="space-y-5">
      <Card title="Accounts and statements" subtitle="All supplied accounts are analysed together. Statements are imported from the bank's Excel / CSV export with an explicit column mapping."
        right={editable && <>
          <button className="btn btn-xs" onClick={() => setAdding(true)}><Plus size={12} /> Account</button>
          <button className="btn btn-p btn-xs" disabled={!b.accounts.length} onClick={() => setImporting(true)}><UploadIcon size={12} /> Import statement</button>
        </>}>
        {!b.accounts.length ? <Empty title="No bank accounts">Add each account the borrower supplied, then import its statements.</Empty> : b.accounts.map((a) => (
          <div key={a.account.id} className="mb-4 rounded-2xl border border-white/10 p-3">
            <p className="font-semibold text-slate-100">{a.account.alias} <span className="text-[12px] font-normal text-slate-500">{[a.account.bankName, a.account.accountLast4 && '••' + a.account.accountLast4].filter(Boolean).join(' · ')}</span></p>
            <p className="text-[12px] text-slate-400">Coverage {a.coverage.from || '—'} → {a.coverage.to || '—'}
              {a.coverage.gaps.length ? <span className="text-amber-200"> · gaps: {a.coverage.gaps.map((g) => g.from + (g.to !== g.from ? '–' + g.to : '')).join(', ')}</span> : a.coverage.from ? ' · continuous' : ''}
              {!a.coverage.balanceTracked && a.statements.length ? ' · balances not on every row' : ''}</p>
            <Table rows={a.statements} cols={['Statement', 'Rows', 'Validation', '']}
              render={(s) => (<>
                <Td className="text-[12px] text-slate-300">{s.periodFrom} → {s.periodTo} <span className="text-slate-500">· file #{s.versionId} · {s.mapping.sheet}</span></Td>
                <Td className="text-[12px] text-slate-400">{s.rowCount}{s.duplicateCount ? ' (' + s.duplicateCount + ' duplicate)' : ''}</Td>
                <Td><Chip cls={s.validationStatus === 'pass' ? 'chip-good' : s.validationStatus === 'fail' ? 'chip-bad' : 'chip-slate'}>{label(s.validationStatus)}</Chip>
                  {s.validationDetail && <span className="block max-w-md text-[11px] text-rose-200">{s.validationDetail}</span>}
                  {s.ackBy && <span className="block text-[11px] text-slate-400">Reviewed by {s.ackBy}: {s.ackNote}</span>}</Td>
                <Td><span className="flex justify-end gap-1">
                  {editable && s.validationStatus === 'fail' && !s.ackBy && <button className="btn btn-xs" onClick={() => setAck(s)}>Review</button>}
                  {editable && <button className="btn btn-ghost btn-xs" disabled={busy} title="Remove import" onClick={() => window.confirm('Remove this imported statement and its transactions?') && run(() => uw.deleteStatement(id, s.id), 'Statement removed.')}><Trash2 size={13} /></button>}
                </span></Td>
              </>)} />
          </div>
        ))}
      </Card>

      {t.transactions > 0 && (<>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Tile k="Receipts (raw)" v={rupees(t.creditsPaise)} />
          <Tile k="Operating receipts (adjusted)" v={rupees(t.operatingPaise)} />
          <Tile k="Internal transfers removed" v={rupees(t.internalTransferPaise)} />
          <Tile k="Unknown receipts" v={rupees(t.unknownPaise)} sub={b.metrics.unknownCreditSharePct != null ? b.metrics.unknownCreditSharePct + '% of receipts' : ''} />
          <Tile k="Financing receipts" v={rupees(t.financingPaise)} />
          <Tile k="Owner / group receipts" v={rupees(t.ownerGroupPaise)} />
          <Tile k="Debt service paid" v={rupees(t.debtServicePaise)} />
          <Tile k="Duplicates excluded" v={t.duplicates} />
        </div>

        <Card title="Consolidated by month" subtitle="Raw and adjusted figures; inter-account transfers are removed from adjusted turnover.">
          <Table rows={b.consolidated} cols={['Month', '#Receipts', '#Adjusted', '#Operating', '#Financing', '#Owner/group', '#Unknown', '#Debits', '#Debt service', 'Returns']}
            render={(m) => (<>
              <Td>{m.month}</Td><Td r>{rupees(m.credits, { dp: 0 })}</Td><Td r>{rupees(m.adjustedCredits, { dp: 0 })}</Td><Td r>{rupees(m.operating, { dp: 0 })}</Td>
              <Td r>{rupees(m.financing, { dp: 0 })}</Td><Td r>{rupees(m.owner_group, { dp: 0 })}</Td><Td r>{rupees(m.unknown, { dp: 0 })}</Td>
              <Td r>{rupees(m.debits, { dp: 0 })}</Td><Td r>{rupees(m.debt_service, { dp: 0 })}</Td><Td r>{m.returns || ''}</Td>
            </>)} />
          {b.accounts.map((a) => (
            <p key={a.account.id} className="mt-2 text-[12px] text-slate-400">{a.account.alias}: {a.months.map((m) => m.month + ' covered ' + m.coveredDays + '/' + m.totalDays + 'd' + (m.minBalancePaise != null ? ', min ' + rupees(m.minBalancePaise, { dp: 0 }) + ', avg ' + rupees(m.avgBalancePaise, { dp: 0 }) : '')).join(' · ')}</p>
          ))}
        </Card>

        <div className="grid gap-5 lg:grid-cols-2">
          <Card title="Counterparty concentration" subtitle={'Operating receipts by tagged counterparty' + (b.untaggedOperatingPaise ? ' · ' + rupees(b.untaggedOperatingPaise) + ' untagged' : '')}>
            <Table rows={b.counterparties} cols={['Counterparty', '#Amount', '#Share', 'Months', '']} empty="Tag counterparties on operating receipts to see concentration."
              render={(x) => (<><Td>{x.counterparty}</Td><Td r>{rupees(x.amountPaise, { dp: 0 })}</Td><Td r>{x.sharePct}%</Td><Td>{x.months}</Td><Td>{x.recurring && <Chip cls="chip-cyan">recurring</Chip>}</Td></>)} />
          </Card>
          <Card title="Investigative leads" subtitle="Pattern flags are leads for the analyst, not fraud findings.">
            <p className="text-sm text-slate-300">{b.flags.returns.length} returned item(s) · {b.flags.negativeBalances.length} month(s) with a negative balance · {b.flags.reviewNeeded} receipt(s) awaiting verification</p>
            {b.flags.returns.slice(0, 10).map((r) => <p key={r.id} className="mt-1 text-[12px] text-rose-200">{r.date} · {rupees(r.amountPaise)} · {r.narration}</p>)}
            {b.flags.negativeBalances.map((n) => <p key={n.account + n.month} className="mt-1 text-[12px] text-amber-200">{n.account} {n.month}: low of {rupees(n.minBalancePaise)}</p>)}
          </Card>
        </div>

        <Transactions id={id} meta={meta} b={b} editable={editable} onChange={() => { reload(); refresh(); }} />
      </>)}

      {adding && <AccountModal id={id} onClose={() => setAdding(false)} onSaved={() => { setAdding(false); reload(); }} />}
      {importing && <ImportModal id={id} meta={meta} b={b} onClose={() => setImporting(false)} onSaved={() => { setImporting(false); reload(); refresh(); }} />}
      {ack && <AckModal s={ack} busy={busy} onClose={() => setAck(null)} onSave={async (note) => { const r = await run(() => uw.ackStatement(id, ack.id, note), 'Validation reviewed.'); if (r) setAck(null); }} />}
    </div>
  );
}

const Tile = ({ k, v, sub }) => (
  <div className="card-tight"><p className="text-[10px] font-semibold uppercase tracking-[.12em] text-slate-500">{k}</p><p className="num mt-0.5 font-display text-lg font-bold text-slate-100">{v}</p>{sub && <p className="text-[11px] text-slate-500">{sub}</p>}</div>
);

function Transactions({ id, meta, b, editable, onChange }) {
  const [reviewOnly, setReviewOnly] = useState(b.flags.reviewNeeded > 0);
  const [direction, setDirection] = useState('');
  const [qtext, setQtext] = useState('');
  const { data, reload } = useLoad(() => uw.transactions(id, { review: reviewOnly ? 1 : '', direction, q: qtext, limit: 500 }), [id, reviewOnly, direction, qtext, b]);
  const [sel, setSel] = useState([]);
  const [cat, setCat] = useState('');
  const [cp, setCp] = useState('');
  const [busy, run] = useAction(() => { setSel([]); reload(); onChange(); });
  const rows = (data && data.rows) || [];
  const selRows = rows.filter((r) => sel.includes(r.id));
  const dirs = new Set(selRows.map((r) => r.direction));
  const cats = dirs.size === 1 ? (dirs.has('credit') ? meta.creditCategories : meta.debitCategories) : meta.creditCategories.filter((c) => meta.debitCategories.includes(c));
  const accountName = (aid) => (b.accounts.find((a) => a.account.id === aid) || { account: {} }).account.alias;

  return (
    <Card title="Transactions" subtitle={(data ? data.total : '…') + ' row(s)' + (b.flags.reviewThresholdPaise == null ? ' · every financing / unknown / auto-matched receipt needs verification (no threshold set)' : ' · verification needed at or above ' + rupees(b.flags.reviewThresholdPaise))}>
      <div className="mb-3 flex flex-wrap items-end gap-3">
        <label className="flex items-center gap-2 pb-2 text-sm text-slate-300"><input type="checkbox" checked={reviewOnly} onChange={(e) => setReviewOnly(e.target.checked)} /> Needs verification only</label>
        <Field label="Direction" className="w-36"><select className="inp" value={direction} onChange={(e) => setDirection(e.target.value)}><option value="">Both</option><option value="credit">Receipts</option><option value="debit">Payments</option></select></Field>
        <Field label="Narration / counterparty" className="w-64"><input className="inp" value={qtext} onChange={(e) => setQtext(e.target.value)} /></Field>
      </div>
      {editable && !!sel.length && (
        <div className="mb-3 flex flex-wrap items-end gap-2 rounded-2xl border border-neon-indigo/30 bg-neon-indigo/[.06] p-3">
          <span className="pb-2 text-sm text-slate-200">{sel.length} selected</span>
          <Field label="Category" className="w-48"><select className="inp" value={cat} onChange={(e) => setCat(e.target.value)}><option value="">(keep)</option>{cats.map((c) => <option key={c} value={c}>{label(c)}</option>)}</select></Field>
          <Field label="Counterparty" className="w-56"><input className="inp" value={cp} onChange={(e) => setCp(e.target.value)} placeholder="(keep)" /></Field>
          <button className="btn btn-p" disabled={busy} onClick={() => run(() => uw.classifyTxns(id, { ids: sel, category: cat || undefined, counterparty: cp.trim() ? cp.trim() : undefined }), 'Classified.')}>Apply</button>
          <button className="btn" disabled={busy} onClick={() => run(() => uw.classifyTxns(id, { ids: sel, isReturn: true }), 'Flagged as returned items.')}>Mark returned</button>
          <button className="btn" disabled={busy} onClick={() => run(() => uw.classifyTxns(id, { ids: sel, isReturn: false }), 'Return flag cleared.')}>Clear return</button>
        </div>
      )}
      <Table rows={rows} loading={!data} cols={['', 'Date', 'Account', 'Narration', '#Amount', '#Balance', 'Category', 'Counterparty']}
        empty={reviewOnly ? 'Nothing awaiting verification.' : 'No transactions.'}
        render={(r) => (<>
          <Td>{editable && <input type="checkbox" checked={sel.includes(r.id)} onChange={(e) => setSel((s) => (e.target.checked ? [...s, r.id] : s.filter((x) => x !== r.id)))} />}</Td>
          <Td className="whitespace-nowrap text-[12px]">{r.valueDate}<span className="block text-[10px] text-slate-600">#{r.id} · row {r.rowIndex}</span></Td>
          <Td className="text-[12px] text-slate-400">{accountName(r.accountId)}</Td>
          <Td className="max-w-sm text-[12px] text-slate-300">{r.rawNarration}{r.isReturn && <Chip cls="chip-bad" className="ml-1">returned</Chip>}</Td>
          <Td r className={r.direction === 'credit' ? 'text-emerald-300' : 'text-slate-300'}>{r.direction === 'credit' ? '+' : '−'}{rupees(r.amountPaise)}</Td>
          <Td r className="text-slate-500">{rupees(r.balancePaise)}</Td>
          <Td><Chip cls={r.category === 'unknown' ? 'chip-warn' : r.category === 'operating' ? 'chip-good' : 'chip-slate'}>{label(r.category)}</Chip><span className="block text-[10px] text-slate-500">{r.categorySource === 'analyst' ? 'by ' + r.classifiedBy : r.categorySource === 'auto_transfer' ? 'auto-matched transfer' : r.categorySource === 'rule' ? 'keyword rule' : 'unclassified'}</span></Td>
          <Td className="text-[12px] text-slate-400">{r.counterparty || '—'}</Td>
        </>)} />
    </Card>
  );
}

function AccountModal({ id, onClose, onSaved }) {
  const [busy, run] = useAction();
  const [f, setF] = useState({ alias: '', bankName: '', accountLast4: '', accountType: '' });
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));
  return (
    <Modal title="Add bank account" onClose={onClose} size="sm"
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn btn-p" disabled={busy || !f.alias.trim()} onClick={async () => { if (await run(() => uw.addAccount(id, f), 'Account added.')) onSaved(); }}>Add</button></>}>
      <div className="space-y-3">
        <Field label="Alias" hint="How the account is referred to in the analysis, e.g. HDFC current."><input className="inp" value={f.alias} onChange={set('alias')} autoFocus /></Field>
        <Field label="Bank"><input className="inp" value={f.bankName} onChange={set('bankName')} /></Field>
        <Field label="Last 4 digits only"><input className="inp" maxLength={4} value={f.accountLast4} onChange={set('accountLast4')} /></Field>
        <Field label="Account type"><input className="inp" value={f.accountType} onChange={set('accountType')} placeholder="Current / CC / OD" /></Field>
      </div>
    </Modal>
  );
}

function ImportModal({ id, meta, b, onClose, onSaved }) {
  const { data: docs } = useLoad(() => uw.documents(id), [id]);
  const files = (docs || []).filter((d) => d.intakeStatus === 'accepted' && ['xlsx', 'csv'].includes(d.detectedType));
  const [m, setM] = useState({ versionId: '', accountId: b.accounts[0].account.id, sheet: '', firstRow: '2', lastRow: '', amountMode: 'split', dateFormat: 'DD/MM/YYYY', openingBalance: '', closingBalance: '', excludeRows: '',
    columns: { date: 'A', narration: 'B', debit: 'C', credit: 'D', amount: '', drcr: '', balance: 'E', reference: '' } });
  const { data: units } = useLoad(() => (m.versionId ? uw.units(id, m.versionId, { limit: 1 }) : Promise.resolve(null)), [id, m.versionId]);
  useEffect(() => { if (units && units.sheets.length && !units.sheets.some((s) => s.sheet === m.sheet)) setM((s) => ({ ...s, sheet: units.sheets[0].sheet })); }, [units]);
  const [preview, setPreview] = useState(null);
  const [err, setErr] = useState(null);
  const [busy, run] = useAction();
  const set = (k) => (e) => { setPreview(null); setM((s) => ({ ...s, [k]: e.target.value })); };
  const setCol = (k) => (e) => { setPreview(null); setM((s) => ({ ...s, columns: { ...s.columns, [k]: e.target.value.toUpperCase() } })); };
  const body = () => ({ ...m, firstRow: Number(m.firstRow), lastRow: m.lastRow ? Number(m.lastRow) : null,
    excludeRows: m.excludeRows.split(/[\s,]+/).filter(Boolean).map(Number) });
  const doPreview = async () => { setErr(null); try { setPreview(await uw.previewImport(id, body())); } catch (e) { setErr(e.message); setPreview(null); } };
  const commit = async () => { const r = await run(() => uw.commitImport(id, body()), 'Statement imported.'); if (r) onSaved(); };

  return (
    <Modal title="Import a bank statement" size="xl" onClose={onClose}
      subtitle="Map the columns, preview, then import. Every row is read strictly; a row that cannot be read is listed, never skipped silently."
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn" onClick={doPreview} disabled={!m.versionId}>Preview</button>
        <button className="btn btn-p" disabled={busy || !preview || preview.errors.length > 0} onClick={commit}>{busy && <Spinner />}Import</button></>}>
      <div className="grid gap-3 sm:grid-cols-4">
        <Field label="File" className="sm:col-span-2"><select className="inp" value={m.versionId} onChange={set('versionId')}><option value="">— spreadsheet / CSV —</option>{files.map((d) => <option key={d.id} value={d.id}>#{d.id} {d.originalName}</option>)}</select></Field>
        <Field label="Sheet"><select className="inp" value={m.sheet} onChange={set('sheet')}>{((units && units.sheets) || []).map((s) => <option key={s.sheet} value={s.sheet}>{s.sheet} ({s.rows} rows)</option>)}</select></Field>
        <Field label="Account"><select className="inp" value={m.accountId} onChange={set('accountId')}>{b.accounts.map((a) => <option key={a.account.id} value={a.account.id}>{a.account.alias}</option>)}</select></Field>
        <Field label="First data row"><input className="inp" type="number" value={m.firstRow} onChange={set('firstRow')} /></Field>
        <Field label="Last data row (optional)"><input className="inp" type="number" value={m.lastRow} onChange={set('lastRow')} /></Field>
        <Field label="Date format"><select className="inp" value={m.dateFormat} onChange={set('dateFormat')}>{meta.dateFormats.map((d) => <option key={d}>{d}</option>)}</select></Field>
        <Field label="Amount layout"><select className="inp" value={m.amountMode} onChange={set('amountMode')}>
          <option value="split">Separate debit / credit columns</option><option value="signed">One signed amount column</option><option value="drcr">Amount + Dr/Cr column</option></select></Field>
        <Field label="Date col"><input className="inp uppercase" value={m.columns.date} onChange={setCol('date')} /></Field>
        <Field label="Narration col"><input className="inp uppercase" value={m.columns.narration} onChange={setCol('narration')} /></Field>
        {m.amountMode === 'split' ? <>
          <Field label="Debit col"><input className="inp uppercase" value={m.columns.debit} onChange={setCol('debit')} /></Field>
          <Field label="Credit col"><input className="inp uppercase" value={m.columns.credit} onChange={setCol('credit')} /></Field>
        </> : <>
          <Field label="Amount col"><input className="inp uppercase" value={m.columns.amount} onChange={setCol('amount')} /></Field>
          {m.amountMode === 'drcr' ? <Field label="Dr/Cr col"><input className="inp uppercase" value={m.columns.drcr} onChange={setCol('drcr')} /></Field> : <div />}
        </>}
        <Field label="Balance col"><input className="inp uppercase" value={m.columns.balance} onChange={setCol('balance')} /></Field>
        <Field label="Reference col"><input className="inp uppercase" value={m.columns.reference} onChange={setCol('reference')} /></Field>
        <Field label="Opening balance (₹, optional)"><input className="inp" value={m.openingBalance} onChange={set('openingBalance')} /></Field>
        <Field label="Closing balance (₹, optional)"><input className="inp" value={m.closingBalance} onChange={set('closingBalance')} /></Field>
        <Field label="Exclude rows" className="sm:col-span-2" hint="Row numbers that are not transactions (e.g. sub-totals), comma-separated."><input className="inp" value={m.excludeRows} onChange={set('excludeRows')} /></Field>
      </div>
      {err && <div className="mt-4"><ErrorNote>{err}</ErrorNote></div>}
      {preview && (
        <div className="mt-4 space-y-3">
          <div className="flex flex-wrap gap-2 text-sm">
            <Chip cls={preview.summary.status === 'pass' ? 'chip-good' : preview.summary.status === 'fail' ? 'chip-bad' : 'chip-slate'}>balance validation: {label(preview.summary.status)}</Chip>
            <Chip cls="chip-slate">{preview.summary.count} rows · {preview.order}</Chip>
            <Chip cls="chip-slate">{preview.summary.from} → {preview.summary.to}</Chip>
            {preview.summary.openingPaise != null && <Chip cls="chip-slate">opening {rupees(preview.summary.openingPaise)}</Chip>}
            {preview.summary.closingPaise != null && <Chip cls="chip-slate">closing {rupees(preview.summary.closingPaise)}</Chip>}
            <Chip cls="chip-slate">{preview.skippedCount} blank/excluded</Chip>
          </div>
          {!!preview.errors.length && <ErrorNote>{preview.errors.length} row(s) could not be read — fix the mapping or exclude them: {preview.errors.slice(0, 8).map((e) => 'row ' + e.row + ': ' + e.message).join(' · ')}</ErrorNote>}
          {!!preview.summary.breaks.length && <p className="text-[12px] text-rose-200">Balance breaks: {preview.summary.breaks.slice(0, 6).map((x) => 'row ' + x.row + ' expected ' + rupees(x.expectedPaise) + ' stated ' + rupees(x.statedPaise)).join(' · ')}</p>}
          {preview.summary.checks.map((c) => <p key={c} className="text-[12px] text-rose-200">{c}</p>)}
          <Table rows={preview.preview} cols={['Row', 'Date', 'Narration', '#Amount', '#Balance']}
            render={(r) => (<><Td>{r.row}</Td><Td>{r.date}</Td><Td className="text-[12px]">{r.narration}</Td>
              <Td r className={r.direction === 'credit' ? 'text-emerald-300' : ''}>{r.direction === 'credit' ? '+' : '−'}{rupees(r.amountPaise)}</Td><Td r>{rupees(r.balancePaise)}</Td></>)} />
        </div>
      )}
    </Modal>
  );
}

function AckModal({ s, onClose, onSave, busy }) {
  const [note, setNote] = useState('');
  return (
    <Modal title="Review failed validation" subtitle={s.validationDetail} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn btn-p" disabled={busy || !note.trim()} onClick={() => onSave(note)}>Record review</button></>}>
      <Field label="What explains the break?" hint="e.g. statement pages missing, bank's own rounding, a row excluded. Recorded on the audit trail."><textarea className="inp min-h-20" value={note} onChange={(e) => setNote(e.target.value)} autoFocus /></Field>
    </Modal>
  );
}
