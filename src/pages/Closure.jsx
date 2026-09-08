import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Calculator, Printer } from 'lucide-react';
import { api } from '../api.js';
import { useAuth } from '../App.jsx';
import { Card, Chip, Empty, ErrorNote, Field, KV, PageHead, Spinner, Table, Td, useToast } from '../ui.jsx';
import { SmaChip } from './Accounts.jsx';
import { useLoad } from '../hooks.js';
import { fmt, fmtCr, fmtDate, today } from '../format.js';

/* What it costs to close a tranche on a chosen date, with the working shown
   rather than a single figure — the borrower is entitled to see how it was
   arrived at. Recording it is an ordinary receipt for that amount, so the same
   waterfall and replay logic applies as to any other payment. */
export default function Closure() {
  const me = useAuth();
  const nav = useNavigate();
  const toast = useToast();
  const [params] = useSearchParams();
  const canWrite = me.role !== 'analyst' && me.role !== 'accounts';

  const { data: drawdowns, loading: listLoading } = useLoad(() => api.drawdowns({}), []);
  const open = (drawdowns || []).filter((d) => d.status !== 'Repaid');

  const [id, setId] = useState(params.get('drawdownId') || '');
  const [date, setDate] = useState(today());
  const [mode, setMode] = useState('keep');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!id && open.length) setId(String(open[0].id));
  }, [open.length, id]);

  const { data, error, loading, reload } = useLoad(
    () => (id ? api.settlement(id, { date, mode }) : Promise.resolve(null)), [id, date, mode]);

  const s = data && data.settlement;
  const d = data && data.drawdown;

  const record = async () => {
    setBusy(true);
    try {
      await api.createPayment({ drawdownId: +id, date, amount: s.total,
        rem: 'Closure settlement' + (s.advanceRefund > 0 ? ' (advance interest refunded)' : '') });
      toast('Closed — the receipt is on the account and the ledger.');
      nav('/borrowers/' + d.borrowerId);
    } catch (e) { toast(e.message, 'err'); setBusy(false); }
  };

  const print = () => window.print();

  return (
    <div className="space-y-5">
      <PageHead icon={Calculator} title="Interest & closure calculator"
        subtitle="Settlement on any date, including early. Interest runs on outstanding principal from the disbursal day; past maturity the penal spread applies on top.">
        {s && <button className="btn no-print" onClick={print}><Printer size={15} /> Print</button>}
      </PageHead>

      <Card>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Field label="Tranche" className="sm:col-span-2">
            <select className="inp" value={id} onChange={(e) => setId(e.target.value)}>
              <option value="">— pick an open tranche —</option>
              {open.map((x) => (
                <option key={x.id} value={x.id}>
                  {(x.ref || '#' + x.id) + ' · ' + x.borrowerName + ' · ' + fmt(x.outPrin) + ' outstanding'}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Settlement date" hint="Back-datable, and it may run past maturity.">
            <input className="inp" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="Advance interest" hint="Only bites when closing inside the advance window.">
            <select className="inp" value={mode} onChange={(e) => setMode(e.target.value)}>
              <option value="keep">Keep it — the advance stays earned</option>
              <option value="refund">Refund the unused days</option>
            </select>
          </Field>
        </div>
        {listLoading && <p className="mt-4 text-sm text-slate-500"><Spinner /> Loading the book…</p>}
        {!listLoading && !open.length && (
          <Empty icon={Calculator} title="Nothing open to settle">Every tranche on the book has been repaid.</Empty>
        )}
      </Card>

      {error && <ErrorNote onRetry={reload}>{error}</ErrorNote>}
      {loading && id && <p className="text-center text-sm text-slate-500"><Spinner /> Working it out…</p>}

      {s && d && (
        <div className="grid gap-5 xl:grid-cols-[1.15fr_.85fr]">
          <Card title={'Settlement — ' + (d.ref || '#' + d.id)} subtitle={d.borrowerName + ' · as at ' + fmtDate(s.date)}>
            <Table cols={['Component', '#Amount']} rows={workingRows(s)}
              render={(r) => (
                <>
                  <td className={r.strong ? 'font-semibold text-slate-100' : 'text-slate-300'}>
                    {r.label}
                    {r.note && <span className="mt-0.5 block text-[11px] text-slate-500">{r.note}</span>}
                  </td>
                  <Td r className={r.strong ? 'font-display text-lg font-bold text-white' : (r.amount < 0 ? 'text-emerald-300' : 'text-slate-200')}>
                    {fmt(r.amount)}
                  </Td>
                </>
              )} />
            {canWrite && (
              <div className="mt-4 flex flex-wrap items-center gap-3 no-print">
                <button className="btn btn-p" disabled={busy || !(s.total > 0)} onClick={record}>
                  {busy && <Spinner />}Record this closure
                </button>
                <p className="text-[11px] text-slate-500">
                  Posts a receipt of {fmt(s.total)} dated {fmtDate(s.date)} against the tranche.
                </p>
              </div>
            )}
          </Card>

          <Card title="The account" subtitle="What the settlement is being computed against">
            <KV k="Borrower" v={d.borrowerName} />
            <KV k="Principal drawn" v={fmt(d.poAmt)} />
            <KV k="Outstanding" v={fmt(d.outPrin)} />
            <KV k="Disbursed on" v={fmtDate(d.bankDebit)} />
            <KV k="Matures" v={fmtDate(d.dueDate)} />
            <KV k="Days elapsed" v={s.days + ' (advance window ' + s.advanceDays + ' days)'} />
            <KV k="Rate" v={data.borrower.rate + '% p.a.' + (s.overdueDays > 0 ? ' · penal +' + data.borrower.penRate + '%' : '')} />
            <KV k="Classification" v={<SmaChip bucket={d.sma} days={d.overdueDays} />} />
            {s.overdueDays > 0 && (
              <div className="mt-3 rounded-xl border border-state-bad/25 bg-state-bad/[.06] px-3 py-2 text-[12px] text-rose-100">
                {s.overdueDays} day(s) past maturity — the penal spread is running on the outstanding principal.
              </div>
            )}
            {!!data.payments.length && (
              <div className="mt-4">
                <p className="ctitle mb-2">Receipts so far</p>
                <Table cols={['Date', '#Amount', '#Interest', '#Principal']} rows={data.payments}
                  render={(p) => (
                    <>
                      <Td className="whitespace-nowrap text-slate-400">{fmtDate(p.date)}</Td>
                      <Td r>{fmt(p.amount)}</Td>
                      <Td r className="text-neon-amber">{fmt(p.intAdj)}</Td>
                      <Td r className="text-emerald-300">{fmt(p.prinAdj)}</Td>
                    </>
                  )} />
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}

/* The working, line by line, in the order a settlement letter would set it out. */
function workingRows(s) {
  const rows = [{ id: 'p', label: 'Outstanding principal', amount: s.principal }];

  if (s.loanType === 'io') {
    rows.push({ id: 'a', label: 'Interest accrued to date', note: 'after the ' + s.advanceDays + '-day advance window', amount: s.accrued });
    rows.push({ id: 'c', label: 'Less: interest already collected', amount: -s.collected });
    if (s.overpaid > 0) {
      rows.push({ id: 'o', label: 'Interest collected beyond accrual',
        note: s.advanceRefund > 0 ? 'being refunded' : 'retained — switch the mode above to refund it', amount: s.overpaid });
    }
  } else {
    rows.push({ id: 'i', label: 'Interest for the days beyond the advance window', amount: s.interestPlain });
    if (s.penal > 0) rows.push({ id: 'x', label: 'Penal interest', note: s.overdueDays + ' day(s) past maturity', amount: s.penal });
    if (s.carriedOverhang > 0) rows.push({ id: 'h', label: 'Interest carried from an earlier short payment', amount: s.carriedOverhang });
  }

  if (s.advanceRefund > 0) {
    rows.push({ id: 'r', label: 'Less: refund of unused advance interest',
      note: (s.unusedAdvanceDays != null ? s.unusedAdvanceDays + ' unused day(s) of the advance window' : 'over-collected interest returned'),
      amount: -s.advanceRefund });
  }

  rows.push({ id: 't', label: 'Total payable to close', amount: s.total, strong: true });
  return rows;
}
