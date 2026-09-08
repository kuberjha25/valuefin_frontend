import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';
import { api } from '../api.js';
import { useAuth } from '../App.jsx';
import { Card, Chip, Empty, ErrorNote, Field, KV, Modal, PageHead, Spinner, Stat, Table, Td, useToast } from '../ui.jsx';
import { SmaChip } from './Accounts.jsx';
import { useLoad } from '../hooks.js';
import { fmt, fmtCr, fmtDate, today, ADV_MODES } from '../format.js';

/* Two ways money goes back out: drawing headroom that was sanctioned but never
   used, and rolling a maturing tranche forward into a fresh one. */
export default function Rotation() {
  const me = useAuth();
  const nav = useNavigate();
  const canWrite = me.role === 'director' || me.role === 'manager';
  const [rotating, setRotating] = useState(null);

  const { data: facilities, error: facErr, loading: facLoading, reload: reloadFac } = useLoad(() => api.borrowers({}), []);
  const { data: drawdowns, error, loading, reload } = useLoad(() => api.drawdowns({}), []);

  const undrawn = (facilities || []).filter((b) => b.available > 0.5).sort((a, b) => b.available - a.available);
  const open = (drawdowns || []).filter((d) => d.status !== 'Repaid');
  /* Worth rotating when it is at or near maturity — inside a fortnight, or
     already past it. */
  const rotatable = open.filter((d) => d.overdueDays > 0 || daysTo(d.dueDate) <= 14)
    .sort((a, b) => String(a.dueDate).localeCompare(String(b.dueDate)));

  const refresh = () => { reload(); reloadFac(); };

  return (
    <div className="space-y-5">
      <PageHead icon={RefreshCw} title="Drawdowns & rotation"
        subtitle="Sanctioned headroom waiting to be drawn, and maturing tranches that can be rolled forward. A rotation settles the old tranche and opens a fresh one in the same step." />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={RefreshCw} label="Undrawn headroom" value={fmtCr(undrawn.reduce((s, b) => s + b.available, 0))}
          accent="lime" sub={undrawn.length + ' facilit(y/ies) with room'} />
        <Stat icon={RefreshCw} label="Maturing or overdue" value={rotatable.length} accent="amber"
          sub="within a fortnight of maturity, or past it" />
        <Stat icon={RefreshCw} label="Live tranches" value={open.length} accent="violet"
          sub={fmtCr(open.reduce((s, d) => s + d.outPrin, 0)) + ' outstanding'} />
        <Stat icon={RefreshCw} label="Rotations to date" value={(drawdowns || []).filter((d) => d.rotatedFrom).length}
          accent="cyan" sub="tranches opened by rolling another forward" />
      </div>

      <Card title="Undrawn limits" subtitle="Sanctioned but not yet on the street — record the drawdown on the borrower file.">
        {facErr ? <ErrorNote onRetry={reloadFac}>{facErr}</ErrorNote> : (
          <Table loading={facLoading} rows={undrawn.map((b) => ({ ...b, id: b.borrowerId }))}
            cols={['Borrower', '#Limit', '#Outstanding', '#Undrawn', 'Utilisation', '']}
            empty={<Empty icon={RefreshCw} title="Every facility is fully drawn">
              Nothing is sanctioned and waiting. Enhance a limit to create headroom.
            </Empty>}
            render={(b) => (
              <>
                <td>
                  <button className="group text-left" onClick={() => nav('/borrowers/' + b.borrowerId)}>
                    <span className="block font-semibold text-slate-100 transition group-hover:text-neon-violet">{b.name}</span>
                    <span className="mt-0.5 block text-[11px] text-slate-500">{b.rate}% p.a. · {b.tenure} {b.tenureUnit}</span>
                  </button>
                </td>
                <Td r>{fmtCr(b.limit)}</Td>
                <Td r>{fmtCr(b.outstanding)}</Td>
                <Td r className="font-semibold text-emerald-300">{fmtCr(b.available)}</Td>
                <Td r className="text-slate-400">{b.utilPct}%</Td>
                <Td>
                  {canWrite && <button className="btn btn-xs" onClick={() => nav('/borrowers/' + b.borrowerId)}>New drawdown</button>}
                </Td>
              </>
            )} />
        )}
      </Card>

      <Card title="Ready to rotate" subtitle="At or past maturity — roll the principal forward rather than calling it back.">
        {error ? <ErrorNote onRetry={reload}>{error}</ErrorNote> : (
          <Table loading={loading} rows={rotatable}
            cols={['Reference', 'Borrower', 'Matures', '#Outstanding', '#Interest accrued', '#Settles at', 'Classification', '']}
            empty={<Empty icon={RefreshCw} title="Nothing is near maturity">
              Tranches appear here inside a fortnight of their due date.
            </Empty>}
            render={(d) => (
              <>
                <td className="font-mono text-[11px] font-semibold text-slate-200">{d.ref || '#' + d.id}</td>
                <td>
                  <button className="text-left text-slate-300 hover:text-neon-violet" onClick={() => nav('/borrowers/' + d.borrowerId)}>
                    {d.borrowerName}
                  </button>
                </td>
                <Td className={'whitespace-nowrap ' + (d.overdueDays > 0 ? 'text-rose-300' : 'text-neon-amber')}>
                  {fmtDate(d.dueDate)}
                  <span className="mt-0.5 block text-[11px] text-slate-500">
                    {d.overdueDays > 0 ? d.overdueDays + ' day(s) overdue' : 'in ' + daysTo(d.dueDate) + ' day(s)'}
                  </span>
                </Td>
                <Td r>{fmt(d.outPrin)}</Td>
                <Td r className="text-neon-amber">{fmt(d.accrued)}</Td>
                <Td r className="font-semibold text-slate-100">{fmt(d.dueTotal)}</Td>
                <Td><SmaChip bucket={d.sma} days={d.overdueDays} /></Td>
                <Td>
                  {canWrite && <button className="btn btn-xs btn-p" onClick={() => setRotating(d)}>Rotate</button>}
                </Td>
              </>
            )} />
        )}
      </Card>

      {rotating && <RotateModal d={rotating} onClose={() => setRotating(null)} onDone={() => { setRotating(null); refresh(); }} />}
    </div>
  );
}

const daysTo = (iso) => Math.round((new Date(iso) - new Date(today())) / 86400000);

function RotateModal({ d, onClose, onDone }) {
  const toast = useToast();
  const [f, setF] = useState({ ref: (d.ref || '') + '-R', date: today(), mode: '30d', cd: '30', feePct: '', capitalise: false, rem: '' });
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));
  const newPrincipal = d.outPrin + (f.capitalise ? d.accrued : 0);

  const save = async () => {
    setBusy(true);
    try {
      await api.rotateDrawdown(d.id, {
        ref: f.ref, date: f.date, mode: f.mode, cd: +f.cd || 30,
        feePct: f.feePct === '' ? undefined : +f.feePct,
        capitaliseInterest: f.capitalise, rem: f.rem
      });
      toast('Rotated — the old tranche is settled and a fresh one is open.');
      onDone();
    } catch (e) { toast(e.message, 'err'); setBusy(false); }
  };

  return (
    <Modal title={'Rotate ' + (d.ref || '#' + d.id)} subtitle={d.borrowerName} size="lg" onClose={onClose}
      footer={<>
        <button className="btn" onClick={onClose} disabled={busy}>Cancel</button>
        <button className="btn btn-p" onClick={save} disabled={busy || !(newPrincipal > 0)}>{busy && <Spinner />}Rotate forward</button>
      </>}>
      <div className="mb-4 rounded-2xl border border-white/8 bg-white/[.03] px-4 py-3">
        <KV k="Outstanding principal" v={fmt(d.outPrin)} />
        <KV k="Interest accrued to date" v={fmt(d.accrued)} />
        <KV k="Settles at" v={fmt(d.dueTotal)} />
        <KV k="New tranche principal" v={<b className="text-slate-100">{fmt(newPrincipal)}</b>} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="New reference"><input className="inp" value={f.ref} onChange={set('ref')} /></Field>
        <Field label="Rotation date"><input className="inp" type="date" value={f.date} onChange={set('date')} /></Field>
        <Field label="Advance interest on the new tranche">
          <select className="inp" value={f.mode} onChange={set('mode')}>
            {ADV_MODES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </Field>
        {f.mode === 'custom' && (
          <Field label="Advance days"><input className="inp" type="number" value={f.cd} onChange={set('cd')} /></Field>
        )}
        <Field label="Processing fee %" hint="Leave blank to use the facility default.">
          <input className="inp" type="number" step="0.1" value={f.feePct} onChange={set('feePct')} />
        </Field>
        <Field label="Remarks" className="sm:col-span-2"><input className="inp" value={f.rem} onChange={set('rem')} placeholder="Optional" /></Field>
      </div>

      <label className="mt-4 flex cursor-pointer items-start gap-2.5 rounded-xl border border-white/8 bg-white/[.03] px-3 py-2.5">
        <input type="checkbox" className="mt-1" checked={f.capitalise}
          onChange={(e) => setF((s) => ({ ...s, capitalise: e.target.checked }))} />
        <span className="text-[13px] leading-snug text-slate-300">
          Roll the accrued interest of {fmt(d.accrued)} into the new principal
          <span className="mt-0.5 block text-[11px] text-slate-500">
            Leave this off to collect the interest in cash and roll only the principal forward.
          </span>
        </span>
      </label>
    </Modal>
  );
}
