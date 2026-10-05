import React, { useEffect, useMemo, useState } from 'react';
import { Check, History, Pencil, X } from 'lucide-react';
import { uw, uwFileUrl } from '../../../api.js';
import { Card, Chip, Empty, Field, Modal, Spinner, Table, Td } from '../../../ui.jsx';
import { useLoad } from '../../../hooks.js';
import { fmtDate } from '../../../format.js';
import { label, rupees } from '../../../uwFormat.js';
import { useAction } from './common.jsx';

const REVIEW = { approved: 'chip-good', provisional: 'chip-warn', proposed: 'chip-cyan', rejected: 'chip-bad' };
const UNIT_LABEL = { INR: '₹', INR_thousands: '₹ thousand', INR_lakhs: '₹ lakh', INR_millions: '₹ million', INR_crores: '₹ crore' };

export const factValue = (f) => (f.valueType === 'money' ? rupees(f.amountPaise) : f.valueType === 'percent' ? f.valueNum + '%' : f.valueNum != null ? f.valueNum : (f.valueDate || f.valueText));
export const factSource = (f) => [f.sourceName, f.sourcePage ? 'p.' + f.sourcePage : null, f.sourceCell, f.sourceTxnId ? 'txn #' + f.sourceTxnId : null].filter(Boolean).join(' · ');

export default function Evidence({ id, meta, editable, refresh, tick }) {
  const { data: docs } = useLoad(() => uw.documents(id), [id, tick]);
  const { data: facts, reload: reloadFacts } = useLoad(() => uw.facts(id), [id, tick]);
  const readable = (docs || []).filter((d) => d.intakeStatus === 'accepted' && d.detectedType !== 'zip');
  const [vid, setVid] = useState(null);
  const [picked, setPicked] = useState(null);
  const v = readable.find((d) => d.id === vid) || readable[0];
  useEffect(() => { setPicked(null); }, [vid]);

  if (!docs) return <Card><Spinner /></Card>;
  if (!readable.length) return <Card><Empty title="No readable files yet">Upload evidence on the Upload & coverage tab.</Empty></Card>;

  return (
    <div className="space-y-5">
      <Card>
        <Field label="Source document">
          <select className="inp" value={v.id} onChange={(e) => setVid(Number(e.target.value))}>
            {readable.map((d) => <option key={d.id} value={d.id}>#{d.id} {d.originalName} (v{d.version}) — {label(d.extractionStatus)}</option>)}
          </select>
        </Field>
        {v.extractionDetail && <p className="mt-2 text-[12px] text-amber-200">{v.extractionDetail}</p>}
      </Card>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        <SourcePane id={id} v={v} picked={picked} onPick={setPicked} />
        <div className="space-y-5">
          {editable
            ? <FactForm id={id} meta={meta} v={v} unit={picked} onSaved={() => { setPicked(null); reloadFacts(); refresh(); }} />
            : <Card><p className="text-sm text-slate-400">Facts are frozen while the case is under review or decided.</p></Card>}
        </div>
      </div>

      <FactsTable id={id} meta={meta} facts={facts} editable={editable} onChange={() => { reloadFacts(); refresh(); }} />
    </div>
  );
}

/* The original next to its extracted lines/cells. Clicking one cites it. */
function SourcePane({ id, v, picked, onPick }) {
  const [page, setPage] = useState(1);
  const [sheet, setSheet] = useState(null);
  const { data } = useLoad(() => uw.units(id, v.id, v.detectedType === 'pdf' ? { page } : sheet ? { sheet } : { limit: 1 }), [id, v.id, page, sheet]);
  useEffect(() => { setPage(1); setSheet(null); }, [v.id]);
  useEffect(() => { if (data && !sheet && data.sheets.length && v.detectedType !== 'pdf') setSheet(data.sheets[0].sheet); }, [data, sheet, v.detectedType]);

  /* Built before any early return so the hook order never changes. */
  const grid = useMemo(() => {
    if (!data || !sheet) return null;
    const rows = new Map();
    let maxCol = 0;
    data.units.forEach((u) => { if (!rows.has(u.rowIndex)) rows.set(u.rowIndex, new Map()); rows.get(u.rowIndex).set(u.colIndex, u); maxCol = Math.max(maxCol, u.colIndex); });
    return { rows: Array.from(rows.keys()).sort((a, b) => a - b).slice(0, 400).map((r) => [r, rows.get(r)]), maxCol: Math.min(maxCol, 30) };
  }, [data, sheet]);
  if (v.detectedType === 'pdf' || v.detectedType === 'image') {
    return (
      <Card title="Original" subtitle={v.detectedType === 'pdf' ? 'Page ' + page + (v.pageCount ? ' of ' + v.pageCount : '') + ' — click a line to cite it' : 'Image — read it and cite the page'}>
        <iframe key={v.id + ':' + page} title="Original document" src={uwFileUrl(id, v.id) + (v.detectedType === 'pdf' ? '#page=' + page : '')}
          className="h-[30rem] w-full rounded-xl border border-white/10 bg-white" />
        {v.detectedType === 'pdf' && (<>
          <div className="mt-3 flex items-center gap-2">
            <button className="btn btn-xs" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous page</button>
            <button className="btn btn-xs" disabled={v.pageCount && page >= v.pageCount} onClick={() => setPage(page + 1)}>Next page</button>
            <span className="text-[11px] text-slate-500">{data ? data.units.length + ' text line(s) on this page' : ''}</span>
          </div>
          <div className="mt-3 max-h-64 overflow-y-auto rounded-xl border border-white/10">
            {data && !data.units.length && <p className="p-3 text-[12px] text-amber-200">No text layer on this page — read it from the original and cite the page number.</p>}
            {data && data.units.map((u) => (
              <button key={u.id} onClick={() => onPick(u)}
                className={'block w-full border-b border-white/[.05] px-3 py-1.5 text-left font-mono text-[12px] ' + (picked && picked.id === u.id ? 'bg-neon-indigo/20 text-white' : 'text-slate-300 hover:bg-white/[.05]')}>
                {u.text}
              </button>
            ))}
          </div>
        </>)}
      </Card>
    );
  }

  // Spreadsheet / CSV grid
  const colName = (n) => { let s = ''; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; };

  return (
    <Card title="Extracted cells" subtitle="Values as stored in the file (cached result for formulas). Click a cell to cite it.">
      {data && data.sheets.length > 1 && (
        <div className="mb-3 flex flex-wrap gap-1.5">{data.sheets.map((s) => (
          <button key={s.sheet} className={'tab ' + (s.sheet === sheet ? 'tab-on' : '')} onClick={() => setSheet(s.sheet)}>{s.sheet}</button>
        ))}</div>
      )}
      {!grid ? <Spinner /> : (
        <div className="max-h-[34rem] overflow-auto rounded-xl border border-white/10">
          <table className="text-[12px]">
            <thead><tr><th className="sticky top-0 bg-ink-900 px-2 text-slate-500" />{Array.from({ length: grid.maxCol }, (_, i) => <th key={i} className="sticky top-0 bg-ink-900 px-2 py-1 text-slate-500">{colName(i + 1)}</th>)}</tr></thead>
            <tbody>{grid.rows.map(([r, cells]) => (
              <tr key={r}>
                <td className="bg-ink-900 px-2 text-right text-slate-600">{r}</td>
                {Array.from({ length: grid.maxCol }, (_, i) => {
                  const u = cells.get(i + 1);
                  return (
                    <td key={i} className="border border-white/[.06] p-0">
                      {u ? (
                        <button onClick={() => onPick(u)} title={(u.formula ? '=' + u.formula + '\n' : '') + (u.numberFormat ? 'format ' + u.numberFormat : '') + (u.mergedRange ? '\nmerged ' + u.mergedRange : '')}
                          className={'block w-full max-w-[14rem] truncate px-2 py-1 text-left ' + (picked && picked.id === u.id ? 'bg-neon-indigo/30 text-white' : u.formula ? 'text-cyan-200 hover:bg-white/[.06]' : 'text-slate-300 hover:bg-white/[.06]')}>
                          {u.text == null ? <span className="text-amber-300">=(no cached value)</span> : u.text}
                        </button>
                      ) : null}
                    </td>
                  );
                })}
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function FactForm({ id, meta, v, unit, onSaved }) {
  const [busy, run] = useAction(onSaved);
  const [f, setF] = useState({ fieldCode: '', rawValue: '', unit: 'INR', periodStart: '', periodEnd: '', basis: 'audited', sourcePage: '', sourceCell: '', sourceNote: '', reviewStatus: 'approved' });
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));
  const field = meta.fieldCodes.find((x) => x.code === f.fieldCode);
  useEffect(() => {
    if (unit && unit.kind === 'cell') setF((s) => ({ ...s, rawValue: unit.text || '' }));
    if (unit && unit.kind === 'line') setF((s) => ({ ...s, rawValue: '', sourcePage: String(unit.page) }));
  }, [unit]);

  const save = () => run(() => uw.addFact(id, {
    fieldCode: f.fieldCode, rawValue: f.rawValue, unit: f.unit, basis: f.basis, reviewStatus: f.reviewStatus, sourceNote: f.sourceNote,
    periodStart: field && field.periodKind === 'flow' ? f.periodStart : null, periodEnd: field && field.periodKind !== 'none' ? f.periodEnd : (f.periodEnd || null),
    sourceVersionId: v.id, sourceUnitId: unit ? unit.id : null,
    sourcePage: unit ? null : (f.sourcePage || null), sourceCell: unit ? null : (f.sourceCell || null)
  }), 'Fact recorded.');

  const groups = meta.fieldCodes.filter((x) => x.active).reduce((m, x) => { (m[x.category] = m[x.category] || []).push(x); return m; }, {});
  return (
    <Card title="Record a fact" subtitle={unit ? (unit.kind === 'cell' ? 'Citing cell ' + unit.sheet + '!' + unit.cellRef + ' — the value is taken from the cell.' : 'Citing a line on page ' + unit.page + ' — the value must appear on it.') : 'Pick a line or cell, or give a page / cell reference.'}>
      {unit && <p className="mb-3 rounded-xl bg-white/[.04] px-3 py-2 font-mono text-[12px] text-slate-200">{unit.kind === 'cell' ? (unit.text == null ? '(no cached value)' : unit.text) : unit.text}</p>}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Field" className="sm:col-span-2">
          <select className="inp" value={f.fieldCode} onChange={set('fieldCode')}>
            <option value="">— select —</option>
            {Object.entries(groups).map(([g, xs]) => <optgroup key={g} label={label(g)}>{xs.map((x) => <option key={x.code} value={x.code}>{x.label}</option>)}</optgroup>)}
          </select>
        </Field>
        <Field label={unit && unit.kind === 'cell' ? 'Value (from the cell)' : 'Value as printed'}>
          <input className="inp" value={f.rawValue} onChange={set('rawValue')} readOnly={!!(unit && unit.kind === 'cell')} />
        </Field>
        {field && field.valueType === 'money'
          ? <Field label="Stated in"><select className="inp" value={f.unit} onChange={set('unit')}>{meta.units.map((u) => <option key={u} value={u}>{UNIT_LABEL[u] || u}</option>)}</select></Field>
          : <div />}
        {field && field.periodKind === 'flow' && <Field label="Period start"><input className="inp" type="date" value={f.periodStart} onChange={set('periodStart')} /></Field>}
        {field && field.periodKind !== 'none' && <Field label={field.periodKind === 'stock' ? 'As at' : 'Period end'}><input className="inp" type="date" value={f.periodEnd} onChange={set('periodEnd')} /></Field>}
        <Field label="Basis"><select className="inp" value={f.basis} onChange={set('basis')}>{meta.bases.map((b) => <option key={b} value={b}>{label(b)}</option>)}</select></Field>
        <Field label="Review"><select className="inp" value={f.reviewStatus} onChange={set('reviewStatus')}><option value="approved">Reviewed</option><option value="provisional">Provisional</option></select></Field>
        {!unit && <Field label="Page"><input className="inp" type="number" min="1" value={f.sourcePage} onChange={set('sourcePage')} /></Field>}
        {!unit && <Field label="or cell / location"><input className="inp" value={f.sourceCell} onChange={set('sourceCell')} placeholder="Sheet1!B12" /></Field>}
        <Field label="Note" className="sm:col-span-2"><input className="inp" value={f.sourceNote} onChange={set('sourceNote')} placeholder="Optional — e.g. note 14, standalone figures" /></Field>
      </div>
      <div className="mt-4 flex justify-end">
        <button className="btn btn-p" disabled={busy || !f.fieldCode || !f.rawValue.trim()} onClick={save}>{busy && <Spinner />}Record fact</button>
      </div>
    </Card>
  );
}

function FactsTable({ id, meta, facts, editable, onChange }) {
  const [correcting, setCorrecting] = useState(null);
  const [rejecting, setRejecting] = useState(null);
  const [hist, setHist] = useState(null);
  const [busy, run] = useAction(onChange);
  return (
    <Card title="Facts on this case" subtitle="Current values only. Corrections supersede — the history of any fact shows every earlier value.">
      <Table rows={facts || []} loading={!facts} cols={['#', 'Field', '#Value', 'Period / basis', 'Source', 'Status', '']}
        empty="No facts recorded yet."
        render={(f) => (<>
          <Td className="text-slate-500">{f.id}</Td>
          <Td className="text-slate-200">{f.fieldLabel || f.fieldCode}<span className="block font-mono text-[10px] text-slate-600">{f.fieldCode}</span></Td>
          <Td r className="text-slate-100">{factValue(f)}<span className="block text-[10px] text-slate-500">raw "{f.rawValue}"{f.originalUnit && f.originalUnit !== 'INR' && f.originalUnit !== 'percent' ? ' ' + (UNIT_LABEL[f.originalUnit] || f.originalUnit) : ''}</span></Td>
          <Td className="text-[12px] text-slate-400">{f.periodEnd ? (f.periodStart ? f.periodStart + ' → ' : 'as at ') + f.periodEnd : '—'}<span className="block">{label(f.basis)}</span></Td>
          <Td className="max-w-[16rem] text-[12px] text-slate-400">{factSource(f)}{f.correctionReason && <span className="block text-amber-200">corrected: {f.correctionReason}</span>}</Td>
          <Td><Chip cls={REVIEW[f.reviewStatus]}>{f.reviewStatus}</Chip><span className="block text-[10px] text-slate-500">{f.createdBy} · {fmtDate(f.createdAt)}</span></Td>
          <Td>
            <span className="flex justify-end gap-1">
              <button className="btn btn-ghost btn-xs" title="History" onClick={() => setHist(f)}><History size={13} /></button>
              {editable && f.reviewStatus !== 'rejected' && <button className="btn btn-ghost btn-xs" title="Correct" onClick={() => setCorrecting(f)}><Pencil size={13} /></button>}
              {editable && ['proposed', 'provisional'].includes(f.reviewStatus) && <button className="btn btn-ghost btn-xs" title="Mark reviewed" disabled={busy} onClick={() => run(() => uw.reviewFact(id, f.id, 'approved'), 'Marked reviewed.')}><Check size={13} /></button>}
              {editable && f.reviewStatus !== 'rejected' && <button className="btn btn-ghost btn-xs text-rose-300" title="Reject" onClick={() => setRejecting(f)}><X size={13} /></button>}
            </span>
          </Td>
        </>)} />
      {correcting && <CorrectModal id={id} meta={meta} f={correcting} onClose={() => setCorrecting(null)} onSaved={() => { setCorrecting(null); onChange(); }} />}
      {rejecting && <RejectModal f={rejecting} busy={busy} onClose={() => setRejecting(null)}
        onSave={async (note) => { const r = await run(() => uw.reviewFact(id, rejecting.id, 'rejected', note), 'Fact rejected.'); if (r) setRejecting(null); }} />}
      {hist && <HistoryModal id={id} f={hist} onClose={() => setHist(null)} />}
    </Card>
  );
}

function CorrectModal({ id, meta, f, onClose, onSaved }) {
  const [busy, run] = useAction();
  const field = meta.fieldCodes.find((x) => x.code === f.fieldCode) || {};
  const [x, setX] = useState({ rawValue: f.rawValue, unit: meta.units.includes(f.originalUnit) ? f.originalUnit : 'INR', periodStart: f.periodStart || '', periodEnd: f.periodEnd || '', basis: f.basis, reason: '', sourcePage: f.sourcePage || '', sourceCell: f.sourceUnitId ? '' : (f.sourceCell || '') });
  const set = (k) => (e) => setX((s) => ({ ...s, [k]: e.target.value }));
  const keepUnit = !!f.sourceUnitId;
  const save = async () => {
    const body = { rawValue: x.rawValue, unit: x.unit, periodStart: x.periodStart || null, periodEnd: x.periodEnd || null, basis: x.basis, reason: x.reason };
    if (!keepUnit) Object.assign(body, { sourcePage: x.sourcePage || null, sourceCell: x.sourceCell || null });
    const r = await run(() => uw.correctFact(id, f.id, body), 'Corrected — a new fact supersedes #' + f.id + '.');
    if (r) onSaved();
  };
  return (
    <Modal title={'Correct fact #' + f.id} subtitle={(f.fieldLabel || f.fieldCode) + ' — the original stays on record'} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn btn-p" disabled={busy || !x.reason.trim()} onClick={save}>{busy && <Spinner />}Save correction</button></>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Value"><input className="inp" value={x.rawValue} onChange={set('rawValue')} /></Field>
        {field.valueType === 'money' ? <Field label="Stated in"><select className="inp" value={x.unit} onChange={set('unit')}>{meta.units.map((u) => <option key={u} value={u}>{UNIT_LABEL[u] || u}</option>)}</select></Field> : <div />}
        {field.periodKind === 'flow' && <Field label="Period start"><input className="inp" type="date" value={x.periodStart} onChange={set('periodStart')} /></Field>}
        {field.periodKind !== 'none' && <Field label="Period end / as at"><input className="inp" type="date" value={x.periodEnd} onChange={set('periodEnd')} /></Field>}
        <Field label="Basis"><select className="inp" value={x.basis} onChange={set('basis')}>{meta.bases.map((b) => <option key={b} value={b}>{label(b)}</option>)}</select></Field>
        {!keepUnit && <Field label="Page"><input className="inp" type="number" value={x.sourcePage} onChange={set('sourcePage')} /></Field>}
        {!keepUnit && <Field label="Cell / location"><input className="inp" value={x.sourceCell} onChange={set('sourceCell')} /></Field>}
        <Field label="Reason for the correction" className="sm:col-span-2"><textarea className="inp min-h-16" value={x.reason} onChange={set('reason')} /></Field>
      </div>
      {keepUnit && <p className="mt-3 text-[11px] text-slate-500">The fact cites an extracted line/cell, so the corrected value must still match that source (change the unit if it is in lakhs or crores).</p>}
    </Modal>
  );
}

function RejectModal({ f, onClose, onSave, busy }) {
  const [note, setNote] = useState('');
  return (
    <Modal title={'Reject fact #' + f.id} onClose={onClose} size="sm"
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn btn-d" disabled={busy || !note.trim()} onClick={() => onSave(note)}>Reject</button></>}>
      <Field label="Why"><textarea className="inp min-h-16" value={note} onChange={(e) => setNote(e.target.value)} autoFocus /></Field>
    </Modal>
  );
}

function HistoryModal({ id, f, onClose }) {
  const { data } = useLoad(() => uw.factHistory(id, f.id), [id, f.id]);
  return (
    <Modal title={'History of fact #' + f.id} onClose={onClose} size="lg">
      <Table rows={data || []} loading={!data} cols={['#', '#Value', 'Period', 'Status', 'By', 'Reason']}
        render={(h) => (<>
          <Td>{h.id}{h.isCurrent ? <Chip cls="chip-good" className="ml-1">current</Chip> : null}</Td>
          <Td r>{factValue(h)}</Td>
          <Td className="text-[12px] text-slate-400">{h.periodEnd || '—'}</Td>
          <Td><Chip cls={REVIEW[h.reviewStatus]}>{h.reviewStatus}</Chip></Td>
          <Td className="text-slate-400">{h.createdBy} · {fmtDate(h.createdAt, true)}</Td>
          <Td className="text-[12px] text-slate-300">{h.correctionReason || h.reviewNote || '—'}</Td>
        </>)} />
    </Modal>
  );
}
