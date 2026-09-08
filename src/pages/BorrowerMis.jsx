import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LineChart, Plus } from 'lucide-react';
import { api } from '../api.js';
import { useAuth } from '../App.jsx';
import { Card, Chip, Empty, ErrorNote, Field, Modal, PageHead, Spinner, Stat, Table, Td, useToast } from '../ui.jsx';
import { useLoad } from '../hooks.js';
import { fmt, fmtCr, today } from '../format.js';

const lastMonth = () => {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  return d.toISOString().slice(0, 7);
};

/* The monthly numbers a growth-capital borrower owes us. Runway is derived from
   closing cash over burn rather than taken on trust, because it is the figure
   the policy actually stops a drawdown on. */
export default function BorrowerMis() {
  const me = useAuth();
  const nav = useNavigate();
  const toast = useToast();
  const canFile = me.role === 'director' || me.role === 'manager';
  const [filing, setFiling] = useState(false);
  const [borrowerId, setBorrowerId] = useState('');

  const { data, error, loading, reload } = useLoad(
    () => api.borrowerMis(borrowerId ? { borrowerId } : {}), [borrowerId]);
  const { data: borrowers } = useLoad(() => api.borrowers({}), []);

  const rows = data || [];
  const latest = rows[0];
  const thin = rows.filter((r) => r.runwayMonths != null && r.runwayMonths < 6);

  return (
    <div className="space-y-5">
      <PageHead icon={LineChart} title="Borrower MIS"
        subtitle="Revenue, burn and closing cash, one row per borrower per month. It feeds the early-warning rules for a revenue drop and for runway falling below six months.">
        {canFile && <button className="btn btn-p" onClick={() => setFiling(true)}><Plus size={15} /> File a month</button>}
      </PageHead>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={LineChart} label="Months on file" value={rows.length} accent="violet"
          sub={new Set(rows.map((r) => r.borrowerId)).size + ' borrower(s) reporting'} />
        <Stat icon={LineChart} label="Latest filed" value={latest ? latest.month : '—'} accent="cyan"
          sub={latest ? latest.borrowerName : 'nothing filed yet'} />
        <Stat icon={LineChart} label="Thin runway" value={thin.length} accent={thin.length ? 'pink' : 'lime'}
          sub="months reported under six months of runway" />
        <Stat icon={LineChart} label="Latest revenue" value={latest ? fmtCr(latest.revenue) : '—'} accent="lime"
          sub={latest ? 'burn ' + fmtCr(latest.burn) : ''} />
      </div>

      <Card title="Monthly filings"
        right={
          <select className="inp w-56" value={borrowerId} onChange={(e) => setBorrowerId(e.target.value)}>
            <option value="">Every borrower</option>
            {(borrowers || []).map((b) => <option key={b.borrowerId} value={b.borrowerId}>{b.name}</option>)}
          </select>
        }>
        {error ? <ErrorNote onRetry={reload}>{error}</ErrorNote> : (
          <Table loading={loading} rows={rows}
            cols={['Month', 'Borrower', '#Revenue', '#Burn', '#Closing cash', '#Runway', 'Filed by']}
            empty={<Empty icon={LineChart} title="No MIS filed yet">
              A Rocket Fuel borrower owes a month within ten days of it ending; a missing month blocks their next drawdown.
            </Empty>}
            render={(r) => (
              <>
                <td className="font-mono text-[12px] font-semibold text-slate-200">{r.month}</td>
                <td>
                  <button className="text-left text-slate-300 hover:text-neon-violet" onClick={() => nav('/borrowers/' + r.borrowerId)}>
                    {r.borrowerName}
                  </button>
                </td>
                <Td r className="text-emerald-300">{fmt(r.revenue)}</Td>
                <Td r className="text-rose-300">{fmt(r.burn)}</Td>
                <Td r>{fmt(r.closingCash)}</Td>
                <Td r>
                  {r.runwayMonths == null ? <span className="text-slate-600">—</span> : (
                    <Chip cls={r.runwayMonths < 3 ? 'chip-bad' : r.runwayMonths < 6 ? 'chip-warn' : 'chip-good'}>
                      {r.runwayMonths} mo
                    </Chip>
                  )}
                </Td>
                <Td className="text-slate-500">{r.createdBy}</Td>
              </>
            )} />
        )}
      </Card>

      {filing && (
        <FileMis borrowers={borrowers || []} onClose={() => setFiling(false)}
          onDone={(r) => {
            setFiling(false);
            toast(r.runwayMonths != null && r.runwayMonths < 6
              ? 'Filed — runway of ' + r.runwayMonths + ' months is below policy, so an alert has been raised.'
              : 'MIS filed.');
            reload();
          }} />
      )}
    </div>
  );
}

function FileMis({ borrowers, onClose, onDone }) {
  const toast = useToast();
  const [f, setF] = useState({ borrowerId: '', month: lastMonth(), revenue: '', burn: '', closingCash: '', note: '' });
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));
  const runway = +f.burn > 0 ? +(+f.closingCash / +f.burn).toFixed(1) : null;

  const save = async () => {
    setBusy(true);
    try {
      onDone(await api.fileBorrowerMis({ borrowerId: +f.borrowerId, month: f.month, revenue: +f.revenue,
        burn: +f.burn, closingCash: +f.closingCash, note: f.note }));
    } catch (e) { toast(e.message, 'err'); setBusy(false); }
  };

  return (
    <Modal title="File a month" size="lg" onClose={onClose}
      subtitle="Re-filing a month you have already sent corrects it rather than adding a second row."
      footer={<>
        <button className="btn" onClick={onClose} disabled={busy}>Cancel</button>
        <button className="btn btn-p" disabled={busy || !f.borrowerId || f.revenue === '' || f.burn === '' || f.closingCash === ''}
          onClick={save}>{busy && <Spinner />}File it</button>
      </>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Borrower">
          <select className="inp" value={f.borrowerId} onChange={set('borrowerId')}>
            <option value="">— select —</option>
            {borrowers.map((b) => <option key={b.borrowerId} value={b.borrowerId}>{b.name}</option>)}
          </select>
        </Field>
        <Field label="Month" hint="The month being reported, not the month you are filing in.">
          <input className="inp" type="month" max={today().slice(0, 7)} value={f.month} onChange={set('month')} />
        </Field>
        <Field label="Revenue (₹)"><input className="inp" type="number" min="0" value={f.revenue} onChange={set('revenue')} /></Field>
        <Field label="Burn (₹)" hint="Total cash out for the month."><input className="inp" type="number" min="0" value={f.burn} onChange={set('burn')} /></Field>
        <Field label="Closing cash (₹)"><input className="inp" type="number" min="0" value={f.closingCash} onChange={set('closingCash')} /></Field>
        <Field label="Runway this implies">
          <p className={'num font-display text-xl font-bold ' + (runway == null ? 'text-slate-500' : runway < 6 ? 'text-neon-amber' : 'text-white')}>
            {runway == null ? '—' : runway + ' months'}
          </p>
          {runway != null && runway < 6 && (
            <p className="mt-1 text-[11px] text-neon-amber">Below six — policy stops further drawdowns and an alert will be raised.</p>
          )}
        </Field>
        <Field label="Note" className="sm:col-span-2"><input className="inp" value={f.note} onChange={set('note')} placeholder="Optional" /></Field>
      </div>
    </Modal>
  );
}
