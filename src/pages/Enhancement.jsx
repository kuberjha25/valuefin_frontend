import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, Plus, TrendingUp, XCircle } from 'lucide-react';
import { api } from '../api.js';
import { useAuth } from '../App.jsx';
import { Card, Chip, Empty, ErrorNote, Field, KV, Meter, Modal, PageHead, Spinner, Stat, Table, Td, useToast } from '../ui.jsx';
import { useLoad } from '../hooks.js';
import { fmt, fmtCr, fmtAgo, fmtDate, today, LOS_PRODUCT } from '../format.js';

const STATUS = { pending: 'chip-warn', approved: 'chip-good', rejected: 'chip-bad' };

/* A limit is not a number someone types over. Raising one re-runs the product's
   own sizing against today's figures, and a Director approves the case before
   the headroom actually appears. */
export default function Enhancement() {
  const me = useAuth();
  const nav = useNavigate();
  const toast = useToast();
  const isDirector = me.role === 'director';
  const canRaise = isDirector || me.role === 'manager';
  const [busy, setBusy] = useState(false);
  const [raising, setRaising] = useState(null);
  const [deciding, setDeciding] = useState(null);

  const { data, error, loading, reload } = useLoad(() => api.enhancements(), []);
  const cases = (data && data.cases) || [];
  const facilities = (data && data.facilities) || [];
  const pending = cases.filter((c) => c.status === 'pending');

  const act = async (fn, msg) => {
    setBusy(true);
    try { await fn(); if (msg) toast(msg); await reload(); }
    catch (e) { toast(e.message, 'err'); }
    finally { setBusy(false); }
  };

  return (
    <div className="space-y-5">
      <PageHead icon={TrendingUp} title="Limit enhancement"
        subtitle="Before agreeing to lend more, the product's own caps run again on today's numbers. The increase only lands when a Director approves the case.">
        {canRaise && <button className="btn btn-p" onClick={() => setRaising({})}><Plus size={15} /> Propose an increase</button>}
      </PageHead>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={TrendingUp} label="Awaiting a decision" value={pending.length} accent={pending.length ? 'amber' : 'lime'}
          sub={fmtCr(pending.reduce((s, c) => s + c.increase, 0)) + ' of proposed increase'} />
        <Stat icon={CheckCircle2} label="Approved" value={cases.filter((c) => c.status === 'approved').length} accent="lime"
          sub="already on the borrowers' limits" />
        <Stat icon={TrendingUp} label="Nearly drawn out" value={facilities.filter((f) => f.utilPct >= 90).length} accent="cyan"
          sub="facilities at 90% or more of their limit" />
        <Stat icon={XCircle} label="Board-level" value={cases.filter((c) => c.boardFlag).length} accent="pink"
          sub="more than 2× the original sanction" />
      </div>

      {error ? <ErrorNote onRetry={reload}>{error}</ErrorNote> : (
        <>
          <Card title="Cases">
            <Table loading={loading} rows={cases}
              cols={['Borrower', '#Current', '#Proposed', '#Policy re-size', 'Raised', 'Status', '']}
              empty={<Empty icon={TrendingUp} title="No cases yet">
                Propose an increase from a facility that is running out of room.
              </Empty>}
              render={(c) => (
                <>
                  <td>
                    <button className="group text-left" onClick={() => nav('/borrowers/' + c.borrowerId)}>
                      <span className="flex items-center gap-2">
                        <span className="font-semibold text-slate-100 transition group-hover:text-neon-violet">{c.borrowerName}</span>
                        {c.boardFlag && <Chip cls="chip-bad">Board</Chip>}
                      </span>
                      <span className="mt-0.5 block text-[11px] text-slate-500">effective {fmtDate(c.effectiveDate)}</span>
                    </button>
                  </td>
                  <Td r className="text-slate-400">{fmt(c.fromLimit)}</Td>
                  <Td r className="font-semibold text-slate-100">{fmt(c.newLimit)}
                    <span className="mt-0.5 block text-[11px] text-emerald-300">+{fmt(c.increase)}</span>
                  </Td>
                  <Td r>
                    {c.sizing ? (
                      <>
                        {fmt(c.sizing.eligible)}
                        <span className={'mt-0.5 block text-[11px] ' + (c.sizing.eligible >= c.newLimit ? 'text-emerald-300' : 'text-neon-amber')}>
                          {c.sizing.eligible >= c.newLimit ? 'supports it' : 'short by ' + fmtCr(c.newLimit - c.sizing.eligible)}
                        </span>
                      </>
                    ) : <span className="text-slate-600">not sized</span>}
                  </Td>
                  <Td className="whitespace-nowrap text-slate-500">{c.raisedBy}
                    <span className="mt-0.5 block text-[11px]">{fmtAgo(c.raisedAt)}</span>
                  </Td>
                  <Td>
                    <Chip cls={STATUS[c.status]}>{c.status}</Chip>
                    {c.decidedBy && <span className="mt-0.5 block text-[11px] text-slate-500">{c.decidedBy}</span>}
                  </Td>
                  <Td>
                    {isDirector && c.status === 'pending' && (
                      <span className="flex justify-end gap-1.5">
                        <button className="btn btn-xs btn-p" disabled={busy} onClick={() => setDeciding({ c, approve: true })}>Approve</button>
                        <button className="btn btn-xs btn-d" disabled={busy} onClick={() => setDeciding({ c, approve: false })}>Reject</button>
                      </span>
                    )}
                  </Td>
                </>
              )} />
          </Card>

          <Card title="Facilities" subtitle="Sorted by how close each one is to its limit">
            <Table loading={loading} rows={facilities.map((f) => ({ ...f, id: f.borrowerId }))}
              cols={['Borrower', 'Product', '#Limit', '#Outstanding', 'Utilisation', '#Headroom', '']}
              empty="No facilities on the book."
              render={(f) => (
                <>
                  <td>
                    <button className="text-left font-medium text-slate-200 hover:text-neon-violet" onClick={() => nav('/borrowers/' + f.borrowerId)}>
                      {f.name}
                    </button>
                  </td>
                  <Td>{f.product ? <Chip cls={(LOS_PRODUCT[f.product] || {}).cls}>{(LOS_PRODUCT[f.product] || {}).label}</Chip>
                    : <span className="text-slate-600">legacy</span>}</Td>
                  <Td r>{fmt(f.limit)}</Td>
                  <Td r>{fmt(f.outstanding)}</Td>
                  <td className="w-36"><Meter value={f.utilPct} max={100} />
                    <span className="num mt-1 block text-[11px] text-slate-500">{f.utilPct}%</span></td>
                  <Td r className="text-emerald-300">{fmt(f.available)}</Td>
                  <Td>{canRaise && <button className="btn btn-xs" onClick={() => setRaising(f)}>Propose</button>}</Td>
                </>
              )} />
          </Card>
        </>
      )}

      {raising && (
        <RaiseModal facilities={facilities} preset={raising.borrowerId} onClose={() => setRaising(null)}
          onSave={async (body) => { await act(() => api.raiseEnhancement(body), 'Sent to the Director.'); setRaising(null); }} />
      )}
      {deciding && (
        <DecideModal c={deciding.c} approve={deciding.approve} onClose={() => setDeciding(null)}
          onSave={async (note) => {
            await act(() => api.decideEnhancement(deciding.c.id, deciding.approve, note),
              deciding.approve ? 'Approved — the limit is live.' : 'Rejected.');
            setDeciding(null);
          }} />
      )}
    </div>
  );
}

function RaiseModal({ facilities, preset, onClose, onSave }) {
  const toast = useToast();
  const [f, setF] = useState({ borrowerId: preset ? String(preset) : '', newLimit: '', effectiveDate: today(), notes: '' });
  const [inputs, setInputs] = useState({});
  const [sizing, setSizing] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));
  const setIn = (k) => (e) => setInputs((s) => ({ ...s, [k]: e.target.value === '' ? '' : +e.target.value }));
  const b = facilities.find((x) => String(x.borrowerId) === f.borrowerId);
  const product = b && b.product;

  const resize = async () => {
    setBusy(true);
    try { const r = await api.previewEnhancement({ borrowerId: +f.borrowerId, inputs }); setSizing(r.sizing); if (!r.sizing) toast(r.note, 'info'); }
    catch (e) { toast(e.message, 'err'); }
    finally { setBusy(false); }
  };

  const short = sizing && +f.newLimit > sizing.eligible;
  const board = b && +f.newLimit > 2 * b.baseLimit;

  return (
    <Modal title="Propose a limit increase" size="lg" onClose={onClose}
      subtitle="Re-size against current figures first — a bigger limit has to be earned, not simply asked for."
      footer={<>
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn btn-p" disabled={!f.borrowerId || !(+f.newLimit > 0)}
          onClick={() => onSave({ borrowerId: +f.borrowerId, newLimit: +f.newLimit, effectiveDate: f.effectiveDate,
            notes: f.notes, inputs })}>Send to the Director</button>
      </>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Borrower" hint={b ? 'currently ' + fmt(b.limit) + ', ' + b.utilPct + '% drawn' : null}>
          <select className="inp" value={f.borrowerId} onChange={(e) => { set('borrowerId')(e); setSizing(null); }}>
            <option value="">— select —</option>
            {facilities.map((x) => <option key={x.borrowerId} value={x.borrowerId}>{x.name}</option>)}
          </select>
        </Field>
        <Field label="Proposed limit (₹)"
          error={short ? 'Above what the re-size supports — the case will carry that on its face.' : null}>
          <input className="inp" type="number" value={f.newLimit} onChange={set('newLimit')} />
        </Field>
        <Field label="Effective date"><input className="inp" type="date" value={f.effectiveDate} onChange={set('effectiveDate')} /></Field>
        {board && (
          <Field label="Approval level">
            <Chip cls="chip-bad">More than 2× the original — Board</Chip>
          </Field>
        )}
      </div>

      {product && (
        <div className="mt-5 rounded-2xl border border-white/8 bg-white/[.03] p-4">
          <p className="ctitle mb-3">Re-size — {(LOS_PRODUCT[product] || {}).label}</p>
          <div className="grid gap-4 sm:grid-cols-3">
            {product === 'quick_cash' && <>
              <Field label="PO paper on hand (₹)"><input className="inp" type="number" value={inputs.poTotal ?? ''} onChange={setIn('poTotal')} /></Field>
              <Field label="Invoice / settlement (₹)"><input className="inp" type="number" value={inputs.invTotal ?? ''} onChange={setIn('invTotal')} /></Field>
              <Field label="Anchor listed?">
                <select className="inp" value={inputs.anchorListed ? '1' : ''} onChange={(e) => setInputs((s) => ({ ...s, anchorListed: !!e.target.value }))}>
                  <option value="">No — 1.20× coverage</option><option value="1">Yes — 1.10×</option>
                </select>
              </Field>
            </>}
            {product === 'rocket_fuel' && <>
              <Field label="Avg monthly revenue (₹)"><input className="inp" type="number" value={inputs.avgMonthlyRevenue ?? ''} onChange={setIn('avgMonthlyRevenue')} /></Field>
              <Field label="Last round (₹)"><input className="inp" type="number" value={inputs.roundSize ?? ''} onChange={setIn('roundSize')} /></Field>
              <Field label="Runway (months)"><input className="inp" type="number" value={inputs.runwayMonths ?? ''} onChange={setIn('runwayMonths')} /></Field>
              <Field label="Monthly burn (₹)"><input className="inp" type="number" value={inputs.monthlyBurn ?? ''} onChange={setIn('monthlyBurn')} /></Field>
              <Field label="Existing external debt (₹)"><input className="inp" type="number" value={inputs.existingDebt ?? 0} onChange={setIn('existingDebt')} /></Field>
            </>}
            {product === 'bullet' && (
              <Field label="Monthly net cash surplus (₹)"><input className="inp" type="number" value={inputs.netCashSurplus ?? ''} onChange={setIn('netCashSurplus')} /></Field>
            )}
          </div>
          <button className="btn mt-3" disabled={busy || !f.borrowerId} onClick={resize}>
            {busy ? <Spinner /> : null} Re-size against these
          </button>

          {sizing && (
            <div className="mt-3">
              <Table cols={['Cap', '#Value']} rows={sizing.caps.map((c, i) => ({ ...c, id: i }))}
                render={(c) => (
                  <>
                    <td className={c.label === sizing.binding ? 'font-semibold text-slate-100' : 'text-slate-300'}>
                      {c.label}{c.label === sizing.binding && <Chip cls="chip-violet ml-1.5">binding</Chip>}
                    </td>
                    <Td r>{fmt(c.value)}</Td>
                  </>
                )} />
              <KV k="What the policy supports" v={<b className="text-slate-100">{fmt(sizing.eligible)}</b>} />
            </div>
          )}
        </div>
      )}

      <div className="mt-4">
        <Field label="The case for it" hint="Why the borrower can carry more, and what has changed since the last sanction.">
          <textarea className="inp min-h-24" value={f.notes} onChange={set('notes')} />
        </Field>
      </div>
    </Modal>
  );
}

function DecideModal({ c, approve, onClose, onSave }) {
  const [note, setNote] = useState('');
  return (
    <Modal title={approve ? 'Approve the increase' : 'Reject the case'} subtitle={c.borrowerName} onClose={onClose}
      footer={<>
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className={approve ? 'btn btn-p' : 'btn btn-d'} disabled={!approve && !note.trim()} onClick={() => onSave(note)}>
          {approve ? 'Approve' : 'Reject'}
        </button>
      </>}>
      <KV k="Limit" v={fmt(c.fromLimit) + ' → ' + fmt(c.newLimit)} />
      <KV k="Increase" v={fmt(c.increase)} />
      {c.sizing && <KV k="Policy re-size supports" v={fmt(c.sizing.eligible) + (c.sizing.eligible < c.newLimit ? ' — short of the ask' : '')} />}
      {c.boardFlag && <KV k="Approval level" v={<Chip cls="chip-bad">More than 2× the original — Board</Chip>} />}
      {c.notes && <KV k="The case made" v={c.notes} />}
      <div className="mt-4">
        <Field label={approve ? 'Note (optional)' : 'Reason for rejection'}>
          <textarea className="inp min-h-24" autoFocus value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
      </div>
      {approve && (
        <p className="mt-3 text-[12px] text-slate-500">
          Approving writes a dated limit event — the headroom appears immediately and the review clock moves with it.
        </p>
      )}
    </Modal>
  );
}
