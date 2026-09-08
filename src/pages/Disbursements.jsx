import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Ban, Banknote, CheckCircle2, Plus, Trash2, XCircle } from 'lucide-react';
import { api } from '../api.js';
import { useAuth } from '../App.jsx';
import { Card, Chip, Empty, ErrorNote, Field, KV, Modal, PageHead, Spinner, Stat, Table, Tabs, Td, useToast } from '../ui.jsx';
import { useLoad, useLocal } from '../hooks.js';
import { fmt, fmtCr, fmtAgo, fmtDate, today, ADV_MODES } from '../format.js';

const STATUS = { pending: 'chip-warn', approved: 'chip-cyan', disbursed: 'chip-good', rejected: 'chip-bad' };

/* No money leaves on one person's say-so: a Manager raises it, a Director
   approves it, and only Accounts pays it out. The tranche is created at the
   moment it is value-dated, so nothing sits half-disbursed. */
export default function Disbursements() {
  const me = useAuth();
  const nav = useNavigate();
  const toast = useToast();
  const [tab, setTab] = useLocal('disbursements.tab', 'approved');
  const [busy, setBusy] = useState(false);
  const [raising, setRaising] = useState(false);
  const [deciding, setDeciding] = useState(null);
  const [paying, setPaying] = useState(null);

  const canRaise = me.role === 'director' || me.role === 'manager';
  const isDirector = me.role === 'director';
  const canPay = me.role === 'accounts' || me.role === 'director';

  const { data, error, loading, reload } = useLoad(() => api.disbursements({ status: tab || undefined }), [tab]);
  const { data: borrowers } = useLoad(() => api.borrowers({}), []);

  const act = async (fn, msg) => {
    setBusy(true);
    try { await fn(); if (msg) toast(msg); await reload(); }
    catch (e) { toast(e.message, 'err'); }
    finally { setBusy(false); }
  };

  const rows = (data && data.requests) || [];
  const counts = (data && data.counts) || {};

  return (
    <div className="space-y-5">
      <PageHead icon={Banknote} title="Disbursement queue"
        subtitle="Maker raises, Director approves, Accounts pays. The drawdown is created at the moment the payout is value-dated — never before.">
        {canRaise && <button className="btn btn-p" onClick={() => setRaising(true)}><Plus size={15} /> Request a payout</button>}
      </PageHead>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={Banknote} label="Awaiting approval" value={counts.pending || 0} accent="amber" sub="with the Director" />
        <Stat icon={CheckCircle2} label="Ready to pay" value={counts.approved || 0} accent="cyan"
          sub={fmtCr((data && data.awaitingPayout) || 0) + ' approved and waiting'} />
        <Stat icon={Banknote} label="Paid out" value={counts.disbursed || 0} accent="lime" sub="on the book as tranches" />
        <Stat icon={XCircle} label="Rejected" value={counts.rejected || 0} accent="pink" sub="sent back to the maker" />
      </div>

      <Card>
        <div className="mb-4">
          <Tabs value={tab} onChange={setTab} tabs={[
            ['approved', 'Ready to pay', counts.approved || 0],
            ['pending', 'Awaiting approval', counts.pending || 0],
            ['disbursed', 'Paid out', counts.disbursed || 0],
            ['rejected', 'Rejected', counts.rejected || 0],
            ['', 'Everything']
          ]} />
        </div>

        {error ? <ErrorNote onRetry={reload}>{error}</ErrorNote> : (
          <Table loading={loading} rows={rows}
            cols={['Borrower', 'Kind', '#Amount', '#Net payout', 'Value date', 'Raised', 'Status', '']}
            empty={<Empty icon={Banknote} title={tab === 'approved' ? 'Nothing waiting to be paid' : 'Nothing here'}>
              {tab === 'approved'
                ? 'Approved requests appear here for the Accounts team to value-date.'
                : 'No requests in this state.'}
            </Empty>}
            render={(r) => (
              <>
                <td>
                  <button className="group text-left" onClick={() => nav('/borrowers/' + r.borrowerId)}>
                    <span className="flex items-center gap-2">
                      <span className="font-semibold text-slate-100 transition group-hover:text-neon-violet">{r.borrowerName}</span>
                      {r.stopDrawdowns && <Chip cls="chip-bad"><Ban size={10} /> stopped</Chip>}
                    </span>
                    <span className="mt-0.5 block text-[11px] text-slate-500">
                      {r.ref || 'no reference'}{r.remarks ? ' · ' + r.remarks : ''}
                    </span>
                  </button>
                </td>
                <Td>
                  <Chip cls={r.kind === 'rotation' ? 'chip-violet' : 'chip-slate'}>{r.kind}</Chip>
                  {r.sourceRef && <span className="mt-0.5 block text-[11px] text-slate-500">of {r.sourceRef}</span>}
                </Td>
                <Td r className="font-semibold text-slate-100">{fmt(r.amount)}</Td>
                <Td r>
                  {fmt(r.preview.net)}
                  <span className="mt-0.5 block text-[11px] text-slate-500">
                    less {fmt(r.preview.advance)} advance · {fmt(r.preview.fee + r.preview.gst)} fee
                  </span>
                </Td>
                <Td className="whitespace-nowrap text-slate-500">{fmtDate(r.valueDate)}</Td>
                <Td className="whitespace-nowrap text-slate-500">
                  {r.raisedBy}
                  <span className="mt-0.5 block text-[11px]">{fmtAgo(r.raisedAt)}</span>
                </Td>
                <Td>
                  <Chip cls={STATUS[r.status]}>{r.status}</Chip>
                  {r.decidedBy && r.status !== 'pending' && (
                    <span className="mt-0.5 block text-[11px] text-slate-500">{r.decidedBy}</span>
                  )}
                  {r.drawdownRef && <span className="mt-0.5 block text-[11px] text-emerald-300">{r.drawdownRef}</span>}
                </Td>
                <Td>
                  <span className="flex justify-end gap-1.5">
                    {isDirector && r.status === 'pending' && <>
                      <button className="btn btn-xs btn-p" disabled={busy} onClick={() => setDeciding({ r, approve: true })}>Approve</button>
                      <button className="btn btn-xs btn-d" disabled={busy} onClick={() => setDeciding({ r, approve: false })}>Reject</button>
                    </>}
                    {canPay && r.status === 'approved' && (
                      <button className="btn btn-xs btn-p" disabled={busy} onClick={() => setPaying(r)}>Pay out</button>
                    )}
                    {canRaise && (r.status === 'pending' || r.status === 'rejected') && (
                      <button className="btn btn-ghost btn-xs" disabled={busy}
                        onClick={() => act(() => api.withdrawDisbursement(r.id), 'Withdrawn.')} title="Withdraw">
                        <Trash2 size={12} />
                      </button>
                    )}
                  </span>
                </Td>
              </>
            )} />
        )}
      </Card>

      {raising && (
        <RaiseModal borrowers={borrowers || []} onClose={() => setRaising(false)}
          onSave={async (body) => { await act(() => api.requestDisbursement(body), 'Sent to the Director.'); setRaising(false); }} />
      )}
      {deciding && (
        <DecideModal r={deciding.r} approve={deciding.approve} onClose={() => setDeciding(null)}
          onSave={async (note) => {
            await act(() => api.decideDisbursement(deciding.r.id, deciding.approve, note),
              deciding.approve ? 'Approved — it is with Accounts now.' : 'Rejected.');
            setDeciding(null);
          }} />
      )}
      {paying && (
        <PayModal r={paying} onClose={() => setPaying(null)}
          onSave={async (valueDate) => {
            await act(() => api.executeDisbursement(paying.id, valueDate), 'Paid out — the tranche is on the book.');
            setPaying(null);
          }} />
      )}
    </div>
  );
}

function RaiseModal({ borrowers, onClose, onSave }) {
  const [f, setF] = useState({ borrowerId: '', kind: 'fresh', sourceDrawdownId: '', amount: '',
    valueDate: today(), mode: '30d', cd: '30', feePct: '', ref: '', remarks: '' });
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));
  const b = borrowers.find((x) => String(x.borrowerId) === f.borrowerId);

  const { data: tranches } = useLoad(
    () => (f.kind === 'rotation' && f.borrowerId ? api.drawdowns({ borrowerId: f.borrowerId }) : Promise.resolve([])),
    [f.kind, f.borrowerId]);
  const open = (tranches || []).filter((d) => d.status !== 'Repaid');

  const over = b && +f.amount > b.available;

  return (
    <Modal title="Request a payout" size="lg" onClose={onClose}
      subtitle="This goes to the Director for approval. Nothing moves until Accounts value-dates it."
      footer={<>
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn btn-p" disabled={!f.borrowerId || !(+f.amount > 0) || over || (f.kind === 'rotation' && !f.sourceDrawdownId)}
          onClick={() => onSave({ ...f, borrowerId: +f.borrowerId, amount: +f.amount,
            sourceDrawdownId: f.kind === 'rotation' ? +f.sourceDrawdownId : undefined,
            cd: +f.cd || undefined, feePct: f.feePct === '' ? undefined : +f.feePct })}>
          Send for approval
        </button>
      </>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Borrower" hint={b ? fmt(b.available) + ' of headroom' : null}>
          <select className="inp" value={f.borrowerId} onChange={set('borrowerId')}>
            <option value="">— select —</option>
            {borrowers.map((x) => <option key={x.borrowerId} value={x.borrowerId}>{x.name}</option>)}
          </select>
        </Field>
        <Field label="Kind" hint="A rotation settles the old tranche as it opens the new one.">
          <select className="inp" value={f.kind} onChange={set('kind')}>
            <option value="fresh">Fresh drawdown</option>
            <option value="rotation">Rotation</option>
          </select>
        </Field>
        {f.kind === 'rotation' && (
          <Field label="Tranche being rolled forward" className="sm:col-span-2">
            <select className="inp" value={f.sourceDrawdownId} onChange={set('sourceDrawdownId')}>
              <option value="">— select —</option>
              {open.map((d) => <option key={d.id} value={d.id}>{(d.ref || '#' + d.id) + ' · ' + fmt(d.outPrin) + ' outstanding'}</option>)}
            </select>
          </Field>
        )}
        <Field label="Amount (₹)" error={over ? 'Above the available headroom of ' + fmt(b.available) + '.' : null}>
          <input className="inp" type="number" value={f.amount} onChange={set('amount')} />
        </Field>
        <Field label="Value date" hint="When the money should actually leave.">
          <input className="inp" type="date" value={f.valueDate} onChange={set('valueDate')} />
        </Field>
        <Field label="Advance interest">
          <select className="inp" value={f.mode} onChange={set('mode')}>
            {ADV_MODES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </Field>
        {f.mode === 'custom' && <Field label="Advance days"><input className="inp" type="number" value={f.cd} onChange={set('cd')} /></Field>}
        <Field label="Processing fee %" hint="Blank uses the facility default.">
          <input className="inp" type="number" step="0.1" value={f.feePct} onChange={set('feePct')} />
        </Field>
        <Field label="Reference"><input className="inp" value={f.ref} onChange={set('ref')} placeholder="e.g. PO-1024" /></Field>
        <Field label="Remarks" className="sm:col-span-2"><input className="inp" value={f.remarks} onChange={set('remarks')} /></Field>
      </div>
    </Modal>
  );
}

function DecideModal({ r, approve, onClose, onSave }) {
  const [note, setNote] = useState('');
  return (
    <Modal title={approve ? 'Approve this payout' : 'Reject this request'} subtitle={r.borrowerName} onClose={onClose}
      footer={<>
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className={approve ? 'btn btn-p' : 'btn btn-d'} disabled={!approve && !note.trim()} onClick={() => onSave(note)}>
          {approve ? 'Approve' : 'Reject'}
        </button>
      </>}>
      <KV k="Amount" v={fmt(r.amount)} />
      <KV k="Net to the borrower" v={fmt(r.preview.net) + ' after ' + fmt(r.preview.advance) + ' advance interest and ' + fmt(r.preview.fee + r.preview.gst) + ' fee'} />
      <KV k="Value date" v={fmtDate(r.valueDate)} />
      <KV k="Raised by" v={r.raisedBy + ' · ' + fmtAgo(r.raisedAt)} />
      <div className="mt-4">
        <Field label={approve ? 'Note (optional)' : 'Reason for rejection'}>
          <textarea className="inp min-h-24" autoFocus value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}

function PayModal({ r, onClose, onSave }) {
  const [valueDate, setValueDate] = useState(r.valueDate);
  return (
    <Modal title="Pay this out" subtitle={r.borrowerName} onClose={onClose}
      footer={<>
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn btn-p" onClick={() => onSave(valueDate)}>Confirm the payout</button>
      </>}>
      <KV k="Principal" v={fmt(r.amount)} />
      <KV k="Advance interest" v={fmt(r.preview.advance) + ' (' + r.preview.advanceDays + ' days)'} />
      <KV k="Processing fee + GST" v={fmt(r.preview.fee) + ' + ' + fmt(r.preview.gst)} />
      <KV k="Net leaving the account" v={<b className="text-slate-100">{fmt(r.preview.net)}</b>} />
      <KV k="Approved by" v={r.decidedBy} />
      <div className="mt-4">
        <Field label="Value date" hint="The date the money actually left. The tranche is created against this date.">
          <input className="inp" type="date" value={valueDate} onChange={(e) => setValueDate(e.target.value)} />
        </Field>
      </div>
      <p className="mt-3 text-[12px] leading-relaxed text-slate-500">
        Confirming creates the tranche on the book{r.kind === 'rotation' ? ' and settles ' + (r.sourceRef || 'the tranche it replaces') : ''}.
        It cannot be undone from here — a payout made in error is corrected by recording a receipt against the tranche.
      </p>
    </Modal>
  );
}
