import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, Download, Landmark, Search } from 'lucide-react';
import { api, downloadCSV } from '../api.js';
import { Card, Chip, Empty, ErrorNote, Field, Meter, PageHead, Spinner, Stat, Table, Tabs, Td } from '../ui.jsx';
import { useDebounced, useLoad, useLocal } from '../hooks.js';
import { fmt, fmtCr, fmtDate, pct, today, PRODUCT } from '../format.js';

/* RBI IRACP: everything past its tenure ages through SMA-0 to SMA-2, and turns
   non-performing on the ninety-first day. */
export const SMA = {
  Standard: 'chip-good', 'SMA-0': 'chip-cyan', 'SMA-1': 'chip-warn', 'SMA-2': 'chip-warn',
  NPA: 'chip-bad', Closed: 'chip-slate'
};
export const SmaChip = ({ bucket, days }) => (
  <Chip cls={SMA[bucket] || 'chip-slate'}>{bucket}{days > 0 ? ' · ' + days + 'd' : ''}</Chip>
);

export default function Accounts() {
  const nav = useNavigate();
  const [tab, setTab] = useLocal('accounts.tab', 'tranches');
  const [term, setTerm] = useState('');
  const q = useDebounced(term, 250);
  const [state, setState] = useLocal('accounts.state', 'open');

  const { data: facilities, error: facErr, loading: facLoading, reload: reloadFac } = useLoad(() => api.borrowers({}), []);
  const { data: tranches, error, loading, reload } = useLoad(() => api.drawdowns({}), []);

  const rows = (tranches || []).filter((d) => {
    if (state === 'open' && d.status === 'Repaid') return false;
    if (state === 'overdue' && !(d.overdueDays > 0)) return false;
    if (state === 'closed' && d.status !== 'Repaid') return false;
    if (!q) return true;
    return ((d.ref || '') + ' ' + (d.borrowerName || '')).toLowerCase().includes(q.toLowerCase());
  });

  const live = (tranches || []).filter((d) => d.status !== 'Repaid');
  const outstanding = live.reduce((s, d) => s + d.outPrin, 0);
  const npa = live.filter((d) => d.sma === 'NPA').reduce((s, d) => s + d.outPrin, 0);
  const sanctioned = (facilities || []).reduce((s, b) => s + b.limit, 0);

  const exportCSV = () => downloadCSV('valuefin_loan_accounts_' + today() + '.csv',
    ['Reference', 'Borrower', 'Product', 'Debit date', 'Matures', 'Principal', 'Outstanding', 'Accrued',
      'Overdue days', 'SMA bucket', 'Status'],
    rows.map((d) => [d.ref, d.borrowerName, PRODUCT[d.loanType].label, d.bankDebit, d.dueDate,
      Math.round(d.poAmt), Math.round(d.outPrin), Math.round(d.accrued), d.overdueDays, d.sma, d.status]));

  return (
    <div className="space-y-5">
      <PageHead icon={Landmark} title="Loan accounts"
        subtitle="Every facility and the tranches drawn against it, classified per RBI IRACP — Standard through SMA-2, and non-performing past ninety days.">
        <button className="btn" onClick={exportCSV} disabled={!rows.length}><Download size={15} /> CSV</button>
      </PageHead>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={Landmark} label="Sanctioned" value={fmtCr(sanctioned)} accent="violet"
          sub={(facilities || []).length + ' facilit(y/ies)'} />
        <Stat icon={ChevronRight} label="Outstanding" value={fmtCr(outstanding)} accent="cyan"
          sub={live.length + ' live tranche(s)'}
          chart={<Meter value={outstanding} max={sanctioned || 1} label={pct(sanctioned ? outstanding / sanctioned * 100 : 0) + ' of the book deployed'} />} />
        <Stat icon={Search} label="Overdue" value={live.filter((d) => d.overdueDays > 0).length} accent="amber"
          sub={fmtCr(live.filter((d) => d.overdueDays > 0).reduce((s, d) => s + d.outPrin, 0)) + ' past tenure'} />
        <Stat icon={ChevronRight} label="Non-performing" value={fmtCr(npa)} accent="pink"
          sub={outstanding > 0 ? pct(npa / outstanding * 100) + ' of the live book' : 'nothing over ninety days'} />
      </div>

      <Card>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <Tabs value={tab} onChange={setTab}
            tabs={[['tranches', 'Tranches', (tranches || []).length], ['facilities', 'Facilities', (facilities || []).length]]} />
        </div>

        {tab === 'facilities' ? (
          facErr ? <ErrorNote onRetry={reloadFac}>{facErr}</ErrorNote> : (
            <Table loading={facLoading} rows={facilities || []}
              cols={['Borrower', 'Product', '#Limit', '#Outstanding', 'Utilisation', '#Undrawn', '#Live tranches', '']}
              empty={<Empty icon={Landmark} title="No facilities yet">Sanction an application to open the first facility.</Empty>}
              render={(b) => (
                <>
                  <td>
                    <button className="group text-left" onClick={() => nav('/borrowers/' + b.borrowerId)}>
                      <span className="block font-semibold text-slate-100 transition group-hover:text-neon-violet">{b.name}</span>
                      <span className="mt-0.5 block text-[11px] text-slate-500">
                        {b.rate}% p.a. · {b.tenure} {b.tenureUnit} · sanctioned {fmtDate(b.sanctionDate)}
                      </span>
                    </button>
                  </td>
                  <Td><Chip cls={PRODUCT[b.loanType].cls}>{PRODUCT[b.loanType].label}</Chip></Td>
                  <Td r>{fmtCr(b.limit)}</Td>
                  <Td r className="font-semibold text-slate-100">{fmtCr(b.outstanding)}</Td>
                  <td className="w-40">
                    <Meter value={b.outstanding} max={b.limit || 1} />
                    <span className="num mt-1 block text-[11px] text-slate-500">{b.utilPct}%</span>
                  </td>
                  <Td r className="text-emerald-300">{fmtCr(b.available)}</Td>
                  <Td r>{b.activeDrawdowns}</Td>
                  <Td>
                    <button className="btn btn-ghost btn-xs" onClick={() => nav('/borrowers/' + b.borrowerId)}><ChevronRight size={16} /></button>
                  </Td>
                </>
              )} />
          )
        ) : (
          <>
            <div className="mb-4 flex flex-wrap items-end gap-3">
              <label className="relative min-w-[15rem] flex-1">
                <span className="lbl">Search</span>
                <Search size={15} className="pointer-events-none absolute bottom-2.5 left-3 text-slate-500" />
                <input className="inp pl-9" value={term} onChange={(e) => setTerm(e.target.value)}
                  placeholder="Reference or borrower…" />
              </label>
              <Field label="Show" className="w-44">
                <select className="inp" value={state} onChange={(e) => setState(e.target.value)}>
                  <option value="open">Live tranches</option>
                  <option value="overdue">Overdue only</option>
                  <option value="closed">Closed</option>
                  <option value="">Everything</option>
                </select>
              </Field>
              {loading && <span className="pb-2.5 text-slate-500"><Spinner /></span>}
            </div>

            {error ? <ErrorNote onRetry={reload}>{error}</ErrorNote> : (
              <Table loading={loading && !tranches} rows={rows}
                cols={['Reference', 'Borrower', 'Debit', 'Matures', '#Principal', '#Outstanding', '#Accrued', 'Classification', 'Status']}
                empty={<Empty icon={Landmark} title="Nothing to show">Adjust the filter, or record a drawdown on a borrower.</Empty>}
                render={(d) => (
                  <>
                    <td className="font-mono text-[11px] font-semibold text-slate-200">
                      {d.ref || '#' + d.id}
                      {d.rotatedFrom && <Chip cls="chip-slate ml-1.5">rotated</Chip>}
                    </td>
                    <td>
                      <button className="text-left text-slate-300 hover:text-neon-violet" onClick={() => nav('/borrowers/' + d.borrowerId)}>
                        {d.borrowerName}
                      </button>
                    </td>
                    <Td className="whitespace-nowrap text-slate-500">{fmtDate(d.bankDebit)}</Td>
                    <Td className={'whitespace-nowrap ' + (d.overdueDays > 0 ? 'text-rose-300' : 'text-slate-500')}>{fmtDate(d.dueDate)}</Td>
                    <Td r>{fmt(d.poAmt)}</Td>
                    <Td r className="font-semibold text-slate-100">{fmt(d.outPrin)}</Td>
                    <Td r className="text-neon-amber">{fmt(d.accrued)}</Td>
                    <Td><SmaChip bucket={d.sma} days={d.overdueDays} /></Td>
                    <Td><Chip cls={d.status === 'Repaid' ? 'chip-slate' : 'chip-cyan'}>{d.status}</Chip></Td>
                  </>
                )}
                footer={rows.length > 1 ? (
                  <tr className="border-t border-white/10">
                    <td className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">{rows.length} tranches</td>
                    <td colSpan={3} />
                    <td className="num px-3 text-right text-slate-300">{fmt(rows.reduce((s, d) => s + d.poAmt, 0))}</td>
                    <td className="num px-3 text-right font-semibold text-white">{fmt(rows.reduce((s, d) => s + d.outPrin, 0))}</td>
                    <td className="num px-3 text-right text-neon-amber">{fmt(rows.reduce((s, d) => s + d.accrued, 0))}</td>
                    <td colSpan={2} />
                  </tr>
                ) : null} />
            )}
          </>
        )}
      </Card>
    </div>
  );
}
