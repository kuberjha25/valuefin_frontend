import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Download, Wallet2 } from 'lucide-react';
import { api, downloadCSV } from '../api.js';
import { Card, Chip, Empty, ErrorNote, PageHead, Stat, Table, Tabs, Td } from '../ui.jsx';
import { SmaChip } from './Accounts.jsx';
import { useLoad, useLocal } from '../hooks.js';
import { fmt, fmtCr, fmtDate, today } from '../format.js';

/* Interest running on the live book today, and every receipt that has come in
   against it. Recording a receipt belongs on the borrower file, where the
   allocation preview and the account history sit together. */
export default function Repayments() {
  const nav = useNavigate();
  const [tab, setTab] = useLocal('repayments.tab', 'accruals');

  const { data: drawdowns, error, loading, reload } = useLoad(() => api.drawdowns({}), []);
  const { data: payments, error: payErr, loading: payLoading, reload: reloadPay } = useLoad(() => api.payments({}), []);

  const open = (drawdowns || []).filter((d) => d.status !== 'Repaid');
  const accrued = open.reduce((s, d) => s + d.accrued, 0);
  const dueTotal = open.reduce((s, d) => s + d.dueTotal, 0);
  const received = (payments || []).reduce((s, p) => s + p.amount, 0);
  const interestCollected = (payments || []).reduce((s, p) => s + p.intAdj, 0);

  const exportCSV = () => downloadCSV('valuefin_receipts_' + today() + '.csv',
    ['Date', 'Borrower', 'Reference', 'Amount', 'Interest applied', 'Principal applied', 'Outstanding after', 'Closed', 'Remarks'],
    (payments || []).map((p) => [p.date, p.borrowerName, p.ref, Math.round(p.amount), Math.round(p.intAdj),
      Math.round(p.prinAdj), Math.round(p.outAfter), p.closed ? 'yes' : 'no', p.rem]));

  return (
    <div className="space-y-5">
      <PageHead icon={Wallet2} title="Repayments & accruals"
        subtitle="What each open tranche has earned to today, and every receipt applied against the book. A receipt clears interest before it touches principal.">
        <button className="btn" onClick={exportCSV} disabled={!(payments || []).length}><Download size={15} /> CSV</button>
      </PageHead>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={Wallet2} label="Accrued, unbilled" value={fmtCr(accrued)} accent="amber"
          sub={'across ' + open.length + ' open tranche(s)'} />
        <Stat icon={Wallet2} label="Due if settled today" value={fmtCr(dueTotal)} accent="violet" sub="principal plus interest to date" />
        <Stat icon={Wallet2} label="Received to date" value={fmtCr(received)} accent="cyan" sub={(payments || []).length + ' receipt(s)'} />
        <Stat icon={Wallet2} label="Interest collected" value={fmtCr(interestCollected)} accent="lime" sub="the interest portion of those receipts" />
      </div>

      <Card>
        <div className="mb-4">
          <Tabs value={tab} onChange={setTab}
            tabs={[['accruals', 'Live accruals', open.length], ['receipts', 'Receipts', (payments || []).length]]} />
        </div>

        {tab === 'accruals' ? (
          error ? <ErrorNote onRetry={reload}>{error}</ErrorNote> : (
            <Table loading={loading} rows={open}
              cols={['Reference', 'Borrower', 'Matures', '#Outstanding', '#Interest accrued', '#Due today', 'Classification', '']}
              empty={<Empty icon={Wallet2} title="Nothing outstanding">Every tranche on the book has been repaid.</Empty>}
              render={(d) => (
                <>
                  <td className="font-mono text-[11px] font-semibold text-slate-200">{d.ref || '#' + d.id}</td>
                  <td>
                    <button className="text-left text-slate-300 hover:text-neon-violet" onClick={() => nav('/borrowers/' + d.borrowerId)}>
                      {d.borrowerName}
                    </button>
                  </td>
                  <Td className={'whitespace-nowrap ' + (d.overdueDays > 0 ? 'text-rose-300' : 'text-slate-500')}>{fmtDate(d.dueDate)}</Td>
                  <Td r>{fmt(d.outPrin)}</Td>
                  <Td r className="text-neon-amber">{fmt(d.accrued)}</Td>
                  <Td r className="font-semibold text-slate-100">{fmt(d.dueTotal)}</Td>
                  <Td><SmaChip bucket={d.sma} days={d.overdueDays} /></Td>
                  <Td>
                    <span className="flex justify-end gap-1.5">
                      <button className="btn btn-xs" onClick={() => nav('/borrowers/' + d.borrowerId)}>Record receipt</button>
                      <button className="btn btn-xs" onClick={() => nav('/closure?drawdownId=' + d.id)}>Settle</button>
                    </span>
                  </Td>
                </>
              )}
              footer={open.length > 1 ? (
                <tr className="border-t border-white/10">
                  <td className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">{open.length} open</td>
                  <td colSpan={2} />
                  <td className="num px-3 text-right text-slate-300">{fmt(open.reduce((s, d) => s + d.outPrin, 0))}</td>
                  <td className="num px-3 text-right text-neon-amber">{fmt(accrued)}</td>
                  <td className="num px-3 text-right font-semibold text-white">{fmt(dueTotal)}</td>
                  <td colSpan={2} />
                </tr>
              ) : null} />
          )
        ) : (
          payErr ? <ErrorNote onRetry={reloadPay}>{payErr}</ErrorNote> : (
            <Table loading={payLoading} rows={payments || []}
              cols={['Date', 'Borrower', 'Reference', '#Received', '#To interest', '#To principal', '#Outstanding after', '']}
              empty={<Empty icon={Wallet2} title="No receipts yet">Record the first one from a borrower file.</Empty>}
              render={(p) => (
                <>
                  <Td className="whitespace-nowrap text-slate-400">{fmtDate(p.date)}</Td>
                  <td>
                    <button className="text-left text-slate-300 hover:text-neon-violet" onClick={() => nav('/borrowers/' + p.borrowerId)}>
                      {p.borrowerName}
                    </button>
                  </td>
                  <Td className="font-mono text-[11px] text-slate-500">{p.ref || '—'}</Td>
                  <Td r className="font-semibold text-slate-100">{fmt(p.amount)}</Td>
                  <Td r className="text-neon-amber">{fmt(p.intAdj)}</Td>
                  <Td r className="text-emerald-300">{fmt(p.prinAdj)}</Td>
                  <Td r>{fmt(p.outAfter)}</Td>
                  <Td>{p.closed && <Chip cls="chip-good">closed the tranche</Chip>}</Td>
                </>
              )} />
          )
        )}
      </Card>
    </div>
  );
}
