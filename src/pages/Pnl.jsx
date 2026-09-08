import React, { useState } from 'react';
import { CircleDollarSign, Download } from 'lucide-react';
import { api, downloadCSV } from '../api.js';
import { Card, ErrorNote, Field, KV, PageHead, Spinner, Stat, Table, Td } from '../ui.jsx';
import { useLoad } from '../hooks.js';
import { fmt, fmtCr, fmtDate, today } from '../format.js';

const fyStart = () => {
  const t = new Date();
  return (t.getMonth() >= 3 ? t.getFullYear() : t.getFullYear() - 1) + '-04-01';
};

/* Income the desk actually banked in a window. Fees are shown net of GST
   throughout: the GST collected is a liability owed onward, never income, and
   is reported on its own line so the two are never added together. */
export default function Pnl() {
  const [from, setFrom] = useState(fyStart());
  const [to, setTo] = useState(today());
  const { data, error, loading, reload } = useLoad(() => api.pnl({ from, to }), [from, to]);

  const exportCSV = () => downloadCSV('valuefin_pnl_' + from + '_to_' + to + '.csv',
    ['Month', 'Processing fees (excl GST)', 'Advance interest', 'Interest collected', 'Total income', 'GST collected'],
    (data.monthly || []).map((m) => [m.month, Math.round(m.processingFees), Math.round(m.advanceInterest),
      Math.round(m.interestCollected), Math.round(m.total), Math.round(m.gst)])
      .concat([['TOTAL', Math.round(data.lines[0].amount), Math.round(data.lines[1].amount),
        Math.round(data.lines[2].amount), Math.round(data.totalIncome), Math.round(data.gstCollected)]]));

  return (
    <div className="space-y-5">
      <PageHead icon={CircleDollarSign} title="P&L"
        subtitle="Income recognised in the period, on the cash basis the desk runs on. Processing fees are always net of GST.">
        <button className="btn" onClick={exportCSV} disabled={!data}><Download size={15} /> CSV</button>
      </PageHead>

      <Card>
        <div className="flex flex-wrap items-end gap-3">
          <Field label="From" className="w-48"><input className="inp" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
          <Field label="To" className="w-48"><input className="inp" type="date" value={to} onChange={(e) => setTo(e.target.value)} /></Field>
          <button className="btn mb-2.5" onClick={() => { setFrom(fyStart()); setTo(today()); }}>This financial year</button>
          {loading && <span className="pb-2.5 text-slate-500"><Spinner /></span>}
        </div>
      </Card>

      {error ? <ErrorNote onRetry={reload}>{error}</ErrorNote> : data && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat icon={CircleDollarSign} label="Total income" value={fmtCr(data.totalIncome)} accent="lime"
              sub={fmtDate(data.from) + ' to ' + fmtDate(data.to)} />
            <Stat icon={CircleDollarSign} label="Principal disbursed" value={fmtCr(data.principalDisbursed)} accent="violet"
              sub={data.disbursedCount + ' drawdown(s)'} />
            <Stat icon={CircleDollarSign} label="Principal repaid" value={fmtCr(data.principalRepaid)} accent="cyan"
              sub={data.receiptCount + ' receipt(s)'} />
            <Stat icon={CircleDollarSign} label="Accrued, unbilled" value={fmtCr(data.accruedUnbilled)} accent="amber"
              sub="earned on the live book but not yet received" />
          </div>

          <div className="grid gap-5 xl:grid-cols-[1.1fr_.9fr]">
            <Card title="Income" subtitle="Every rupee recognised in the window, and where it came from">
              <Table cols={['Line', '#Amount']} rows={data.lines.map((l, i) => ({ ...l, id: i }))}
                render={(l) => (
                  <>
                    <td className="text-slate-200">{l.label}
                      <span className="mt-0.5 block text-[11px] text-slate-500">{l.note}</span>
                    </td>
                    <Td r>{fmt(l.amount)}</Td>
                  </>
                )}
                footer={<>
                  <tr className="border-t border-white/10">
                    <td className="px-3 py-2.5 font-semibold text-slate-100">Total income</td>
                    <td className="num px-3 py-2.5 text-right font-display text-lg font-bold text-white">{fmt(data.totalIncome)}</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 text-[12px] text-slate-500">
                      GST collected — a liability passed on, not income
                    </td>
                    <td className="num px-3 py-2 text-right text-slate-500">{fmt(data.gstCollected)}</td>
                  </tr>
                </>} />
            </Card>

            <Card title="Month by month">
              <Table cols={['Month', '#Fees', '#Advance', '#Interest', '#Total']} rows={data.monthly.map((m) => ({ ...m, id: m.month }))}
                empty="No activity in this window."
                render={(m) => (
                  <>
                    <td className="text-slate-200">{m.month}</td>
                    <Td r>{fmt(m.processingFees)}</Td>
                    <Td r>{fmt(m.advanceInterest)}</Td>
                    <Td r>{fmt(m.interestCollected)}</Td>
                    <Td r className="font-semibold text-slate-100">{fmt(m.total)}</Td>
                  </>
                )} />
            </Card>
          </div>

          <Card title="How these figures are recognised">
            <KV k="Processing fees" v="Taken at disbursal, net of GST — recognised on the drawdown date" />
            <KV k="Advance interest" v="Deducted upfront on the drawdown, recognised on the same date" />
            <KV k="Interest collected" v="The interest portion of each receipt, recognised when the money arrives" />
            <KV k="Accrued but unbilled" v="Earned on open tranches and not yet received — outside this cash-basis total" />
          </Card>
        </>
      )}
    </div>
  );
}
