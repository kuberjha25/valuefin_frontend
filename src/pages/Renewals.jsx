import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, CalendarClock, CheckCircle2, Plus } from 'lucide-react';
import { api } from '../api.js';
import { useAuth } from '../App.jsx';
import { Card, Chip, Empty, ErrorNote, Field, KV, Modal, PageHead, Spinner, Stat, Table, Td, useToast } from '../ui.jsx';
import { useLoad } from '../hooks.js';
import { fmt, fmtCr, fmtAgo, fmtDate, today } from '../format.js';

const STATUS = { pending: 'chip-warn', approved: 'chip-good', rejected: 'chip-bad' };
const plusYear = (iso) => { const d = new Date(iso); d.setFullYear(d.getFullYear() + 1); return d.toISOString().slice(0, 10); };

/* A facility does not roll on by default. The conduct gates are computed from
   what the book actually did — a failed one can still be renewed, but only on a
   written deviation that stays on the case. */
export default function Renewals() {
  const me = useAuth();
  const nav = useNavigate();
  const toast = useToast();
  const isDirector = me.role === 'director';
  const canRaise = isDirector || me.role === 'manager';
  const [busy, setBusy] = useState(false);
  const [raising, setRaising] = useState(null);
  const [deciding, setDeciding] = useState(null);

  const { data, error, loading, reload } = useLoad(() => api.renewals(), []);
  const cases = (data && data.cases) || [];
  const due = (data && data.due) || [];
  const pending = cases.filter((c) => c.status === 'pending');
  const overdue = due.filter((d) => d.status === 'overdue');

  const act = async (fn, msg) => {
    setBusy(true);
    try { await fn(); if (msg) toast(msg); await reload(); }
    catch (e) { toast(e.message, 'err'); }
    finally { setBusy(false); }
  };

  return (
    <div className="space-y-5">
      <PageHead icon={CalendarClock} title="Loan renewals"
        subtitle="The annual review. Facilities show up here forty-five days out, with conduct gates computed off the book rather than asserted.">
        {canRaise && !!due.length && <button className="btn btn-p" onClick={() => setRaising(due[0])}><Plus size={15} /> Propose a renewal</button>}
      </PageHead>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={AlertTriangle} label="Overdue" value={overdue.length} accent={overdue.length ? 'pink' : 'lime'}
          sub={overdue.length ? 'no fresh money should go out on these' : 'nothing has run past its review'} />
        <Stat icon={CalendarClock} label="Coming up" value={due.filter((d) => d.status !== 'overdue').length} accent="amber"
          sub="inside the next forty-five days" />
        <Stat icon={CalendarClock} label="Awaiting a decision" value={pending.length} accent="cyan" sub="with the Director" />
        <Stat icon={CheckCircle2} label="Renewed" value={cases.filter((c) => c.status === 'approved').length} accent="lime"
          sub="rolled on for another year" />
      </div>

      {error ? <ErrorNote onRetry={reload}>{error}</ErrorNote> : (
        <>
          <Card title="Due for review" subtitle="Every facility inside forty-five days of its review date, or already past it">
            <Table loading={loading} rows={due.map((d) => ({ ...d, id: d.borrowerId }))}
              cols={['Borrower', '#Outstanding', 'Review date', 'Conduct gates', '']}
              empty={<Empty icon={CheckCircle2} title="Nothing due">
                No facility is within forty-five days of its annual review.
              </Empty>}
              render={(d) => (
                <>
                  <td>
                    <button className="text-left font-medium text-slate-200 hover:text-neon-violet" onClick={() => nav('/borrowers/' + d.borrowerId)}>
                      {d.name}
                      <span className="mt-0.5 block text-[11px] text-slate-500">{d.rate}% p.a.</span>
                    </button>
                  </td>
                  <Td r>{fmt(d.outstanding)}</Td>
                  <Td className="whitespace-nowrap">
                    <span className={d.status === 'overdue' ? 'text-rose-300' : 'text-neon-amber'}>{fmtDate(d.renewDate)}</span>
                    <span className="mt-0.5 block text-[11px] text-slate-500">
                      {d.daysLeft < 0 ? Math.abs(d.daysLeft) + ' day(s) overdue' : 'in ' + d.daysLeft + ' day(s)'}
                    </span>
                  </Td>
                  <Td>
                    <span className="flex flex-wrap gap-1">
                      {d.gates.map((g) => (
                        <Chip key={g.key} cls={g.pass ? 'chip-good' : 'chip-bad'} title={g.detail}>
                          {g.pass ? '✓' : '✕'} {g.label.replace(/^No /, '')}
                        </Chip>
                      ))}
                    </span>
                  </Td>
                  <Td>{canRaise && <button className="btn btn-xs" onClick={() => setRaising(d)}>Propose</button>}</Td>
                </>
              )} />
          </Card>

          <Card title="Renewal cases">
            <Table loading={loading} rows={cases}
              cols={['Borrower', 'New expiry', 'Rate', 'Gates at the time', 'Raised', 'Status', '']}
              empty={<Empty icon={CalendarClock} title="No renewal cases yet">
                Propose one from a facility that is coming up for review.
              </Empty>}
              render={(c) => {
                const failed = c.gates.filter((g) => !g.pass);
                return (
                  <>
                    <td>
                      <button className="text-left font-medium text-slate-200 hover:text-neon-violet" onClick={() => nav('/borrowers/' + c.borrowerId)}>
                        {c.borrowerName}
                      </button>
                    </td>
                    <Td className="whitespace-nowrap text-slate-400">{fmtDate(c.newExpiry)}</Td>
                    <Td>
                      {c.newRate}%
                      {!!c.cutBps && <span className="mt-0.5 block text-[11px] text-emerald-300">down {c.cutBps} bps</span>}
                    </Td>
                    <Td>{failed.length
                      ? <Chip cls="chip-warn">{failed.length} failed — on a deviation</Chip>
                      : <Chip cls="chip-good">all clean</Chip>}</Td>
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
                );
              }} />
          </Card>
        </>
      )}

      {raising && (
        <RaiseModal due={due} preset={raising.borrowerId} onClose={() => setRaising(null)}
          onSave={async (body) => { await act(() => api.raiseRenewal(body), 'Sent to the Director.'); setRaising(null); }} />
      )}
      {deciding && (
        <DecideModal c={deciding.c} approve={deciding.approve} onClose={() => setDeciding(null)}
          onSave={async (note) => {
            await act(() => api.decideRenewal(deciding.c.id, deciding.approve, note),
              deciding.approve ? 'Renewed — the review clock has moved forward.' : 'Rejected.');
            setDeciding(null);
          }} />
      )}
    </div>
  );
}

function RaiseModal({ due, preset, onClose, onSave }) {
  const [borrowerId, setBorrowerId] = useState(preset ? String(preset) : '');
  const b = due.find((x) => String(x.borrowerId) === borrowerId);
  const [f, setF] = useState({ newExpiry: plusYear(today()), cutBps: '0', behaviour: '', deviationNote: '' });
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));
  const failed = b ? b.gates.filter((g) => !g.pass) : [];
  const newRate = b ? Math.max(0, +(b.rate - (+f.cutBps || 0) / 100).toFixed(2)) : null;

  return (
    <Modal title="Propose a renewal" size="lg" onClose={onClose}
      subtitle="The gates below are computed from the book. A failed one can still be renewed, but only on a written deviation."
      footer={<>
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn btn-p"
          disabled={!borrowerId || !f.behaviour.trim() || (failed.length > 0 && !f.deviationNote.trim())}
          onClick={() => onSave({ borrowerId: +borrowerId, newExpiry: f.newExpiry, cutBps: +f.cutBps || 0,
            behaviour: f.behaviour, deviationNote: f.deviationNote })}>Send to the Director</button>
      </>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Borrower">
          <select className="inp" value={borrowerId} onChange={(e) => setBorrowerId(e.target.value)}>
            <option value="">— select —</option>
            {due.map((d) => <option key={d.borrowerId} value={d.borrowerId}>
              {d.name} — review {d.renewDate}{d.status === 'overdue' ? ' (overdue)' : ''}
            </option>)}
          </select>
        </Field>
        <Field label="New expiry"><input className="inp" type="date" value={f.newExpiry} onChange={set('newExpiry')} /></Field>
        <Field label="Rate cut (bps)" hint="Capped at 100 bps, and never below the product floor.">
          <input className="inp" type="number" min="0" max="100" value={f.cutBps} onChange={set('cutBps')} />
        </Field>
        {b && (
          <Field label="Rate after renewal">
            <p className="num font-display text-xl font-bold text-white">{newRate}%</p>
            <p className="mt-1 text-[11px] text-slate-500">from {b.rate}%</p>
          </Field>
        )}
      </div>

      {b && (
        <div className="mt-5 space-y-1.5">
          <p className="ctitle">Conduct gates</p>
          {b.gates.map((g) => (
            <div key={g.key} className={'flex items-start gap-2 rounded-xl border px-3 py-2 text-[13px] ' +
              (g.pass ? 'border-state-good/20 bg-state-good/[.05]' : 'border-state-bad/25 bg-state-bad/[.06]')}>
              {g.pass ? <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-emerald-300" />
                : <AlertTriangle size={14} className="mt-0.5 shrink-0 text-rose-300" />}
              <span className="flex-1 text-slate-200">{g.label}
                <span className="mt-0.5 block text-[11px] text-slate-500">{g.detail}</span>
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="mt-4 space-y-4">
        <Field label="How the account has behaved"
          hint="Repayment discipline, rotations used, MIS quality — the things a number cannot show.">
          <textarea className="inp min-h-24" value={f.behaviour} onChange={set('behaviour')} />
        </Field>
        {failed.length > 0 && (
          <Field label="Deviation note" error={!f.deviationNote.trim() ? 'Mandatory — ' + failed.length + ' gate(s) failed.' : null}
            hint="Why the facility should roll on despite the failed gate, and what is being done about it.">
            <textarea className="inp min-h-24" value={f.deviationNote} onChange={set('deviationNote')} />
          </Field>
        )}
      </div>
    </Modal>
  );
}

function DecideModal({ c, approve, onClose, onSave }) {
  const [note, setNote] = useState('');
  const failed = c.gates.filter((g) => !g.pass);
  return (
    <Modal title={approve ? 'Renew this facility' : 'Reject the renewal'} subtitle={c.borrowerName} onClose={onClose}
      footer={<>
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className={approve ? 'btn btn-p' : 'btn btn-d'} disabled={!approve && !note.trim()} onClick={() => onSave(note)}>
          {approve ? 'Renew' : 'Reject'}
        </button>
      </>}>
      <KV k="New expiry" v={fmtDate(c.newExpiry)} />
      <KV k="Rate" v={c.currentRate + '% → ' + c.newRate + '%' + (c.cutBps ? ' (down ' + c.cutBps + ' bps)' : '')} />
      <KV k="Gates when raised" v={failed.length ? failed.length + ' failed' : 'all clean'} />
      {c.behaviour && <KV k="Conduct" v={c.behaviour} />}
      {c.deviationNote && <KV k="Deviation" v={c.deviationNote} />}
      <div className="mt-4">
        <Field label={approve ? 'Note (optional)' : 'Reason for rejection'}>
          <textarea className="inp min-h-24" autoFocus value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
      </div>
      {approve && (
        <p className="mt-3 text-[12px] text-slate-500">
          Renewing moves the review clock forward{c.newRate !== c.currentRate ? ' and re-prices every open tranche from its own payment history' : ''}.
        </p>
      )}
    </Modal>
  );
}
