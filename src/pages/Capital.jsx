import React, { useState } from 'react';
import { Database, Plus, Trash2 } from 'lucide-react';
import { api } from '../api.js';
import { useAuth } from '../App.jsx';
import { Card, Chip, Empty, ErrorNote, Field, KV, Meter, Modal, PageHead, Spinner, Stat, Table, Td, useToast } from '../ui.jsx';
import { useLoad } from '../hooks.js';
import { fmt, fmtCr, fmtDate, pct, today } from '../format.js';

/* An NBFC earns on capital that is lent out. What is raised and then left in a
   deposit or a current account is costing its funding rate and earning almost
   nothing, so the number that matters here is the gap. */
export default function Capital() {
  const me = useAuth();
  const toast = useToast();
  const isDirector = me.role === 'director';
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState(null);

  const { data, error, loading, reload } = useLoad(() => api.capital(), []);

  const act = async (fn, msg) => {
    setBusy(true);
    try { await fn(); if (msg) toast(msg); await reload(); }
    catch (e) { toast(e.message, 'err'); }
    finally { setBusy(false); }
  };

  if (loading) return <div className="py-16 text-center"><Spinner size={20} /></div>;
  if (error) return <ErrorNote onRetry={reload}>{error}</ErrorNote>;
  if (!data) return null;

  const { now, series, funding, parked, catalogue } = data;
  const notWorking = now.parked + now.idle;

  return (
    <div className="space-y-5">
      <PageHead icon={Database} title="Capital deployment"
        subtitle="Where the money came from, what it costs, and how much of it is actually on the street rather than parked.">
        {isDirector && <>
          <button className="btn" onClick={() => setAdding('parked')}><Plus size={15} /> Parked balance</button>
          <button className="btn btn-p" onClick={() => setAdding('funding')}><Plus size={15} /> Funding entry</button>
        </>}
      </PageHead>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={Database} label="Capital raised, net" value={fmtCr(now.funds)} accent="violet"
          sub={now.cost ? 'blended cost ' + now.cost + '% on interest-bearing money' : 'nothing interest-bearing yet'} />
        <Stat icon={Database} label="On the street" value={fmtCr(now.loans)} accent="lime"
          sub={now.utilPct == null ? 'record a funding entry to see utilisation' : pct(now.utilPct) + ' of capital deployed'}
          chart={<Meter value={now.loans} max={now.funds || 1} />} />
        <Stat icon={Database} label="Parked" value={fmtCr(now.parked)} accent="amber"
          sub={Object.keys(now.parkedBy).length
            ? Object.entries(now.parkedBy).map(([b, v]) => b + ' ' + fmtCr(v)).join(' · ')
            : 'nothing in deposits or funds'} />
        <Stat icon={Database} label="Idle" value={fmtCr(now.idle)} accent={now.idle > 0 ? 'pink' : 'cyan'}
          sub={now.funds > 0 ? pct(notWorking / now.funds * 100) + ' of capital is not lending' : 'no capital recorded'} />
      </div>

      {now.funds > 0 && notWorking > 0 && (
        <div className="rounded-2xl border border-neon-amber/25 bg-neon-amber/[.06] px-4 py-3 text-[13px] text-amber-100">
          <b>{fmtCr(notWorking)}</b> is raised but not lent — {pct(notWorking / now.funds * 100)} of the book's capital.
          {now.cost > 0 && ' At a blended ' + now.cost + '%, that is roughly ' + fmtCr(notWorking * now.cost / 100) +
            ' of funding cost a year against very little income.'}
        </div>
      )}

      <Card title="Month by month" subtitle="Each month rebuilt at its month end from the dated entries — the current month is as at today.">
        <Table rows={series.map((s) => ({ ...s, id: s.month }))}
          cols={['Month', '#Capital', '#Lent', '#Parked', '#Idle', 'Utilisation', 'Mix']}
          empty={<Empty icon={Database} title="Nothing to rebuild yet">
            Record the first funding entry — a director infusion is usually where it starts.
          </Empty>}
          render={(s) => (
            <>
              <td className="font-mono text-[12px] font-semibold text-slate-200">{s.month}</td>
              <Td r>{fmt(s.funds)}</Td>
              <Td r className="text-emerald-300">{fmt(s.loans)}</Td>
              <Td r className={s.parked > 0 ? 'text-neon-amber' : 'text-slate-600'}>{fmt(s.parked)}</Td>
              <Td r className={s.idle > 0 ? 'text-rose-300' : 'text-slate-600'}>{fmt(s.idle)}</Td>
              <Td r className="font-semibold text-slate-100">{s.utilPct == null ? '—' : pct(s.utilPct)}</Td>
              <td className="w-40">
                <div className="flex h-2.5 overflow-hidden rounded-full bg-white/[.06]">
                  {[['bg-state-good', s.loans], ['bg-neon-amber', s.parked], ['bg-state-bad', s.idle]].map(([cls, v], i) => (
                    v > 0 ? <span key={i} className={cls} style={{ width: (v / Math.max(1, s.funds) * 100) + '%' }} /> : null
                  ))}
                </div>
              </td>
            </>
          )} />
        <p className="mt-3 text-[11px] text-slate-500">Green is lent, amber is parked, red is idle.</p>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Where the capital came from">
          <Table rows={funding} cols={['Date', 'Source', '#Amount', 'Rate', '']}
            empty={<Empty icon={Database} title="No funding recorded">
              Start with the directors' own infusions, then add bank and NBFC lines as they land.
            </Empty>}
            render={(f) => (
              <>
                <Td className="whitespace-nowrap text-slate-400">{fmtDate(f.date)}</Td>
                <td className="text-slate-200">
                  {f.source}
                  {f.direction === 'out' && <Chip cls="chip-bad ml-1.5">repaid</Chip>}
                  <span className="mt-0.5 block text-[11px] text-slate-500">
                    {f.counterparty || 'counterparty not named'}{f.maturity ? ' · matures ' + fmtDate(f.maturity) : ''}
                  </span>
                </td>
                <Td r className={f.direction === 'out' ? 'text-rose-300' : 'text-slate-100'}>
                  {f.direction === 'out' ? '−' : ''}{fmt(f.amount)}
                </Td>
                <Td className="text-slate-400">{f.rate ? f.rate + '%' : '—'}</Td>
                <Td>{isDirector && (
                  <button className="btn btn-ghost btn-xs" disabled={busy}
                    onClick={() => act(() => api.deleteFunding(f.id), 'Removed.')}><Trash2 size={12} /></button>
                )}</Td>
              </>
            )} />
        </Card>

        <Card title="Parked balances"
          subtitle="Each entry sets a bucket as at a date — it does not add to it. Broke a deposit? Record it again at zero.">
          <Table rows={parked} cols={['As at', 'Bucket', 'Label', '#Balance', '']}
            empty={<Empty icon={Database} title="Nothing parked">
              Everything raised is either lent out or sitting as idle cash.
            </Empty>}
            render={(p) => (
              <>
                <Td className="whitespace-nowrap text-slate-400">{fmtDate(p.asOf)}</Td>
                <Td><Chip cls="chip-slate">{p.bucket}</Chip></Td>
                <td className="text-slate-300">{p.label || '—'}
                  {p.note && <span className="mt-0.5 block text-[11px] text-slate-500">{p.note}</span>}
                </td>
                <Td r className="font-semibold text-slate-100">{fmt(p.balance)}</Td>
                <Td>{isDirector && (
                  <button className="btn btn-ghost btn-xs" disabled={busy}
                    onClick={() => act(() => api.deleteParked(p.id), 'Removed.')}><Trash2 size={12} /></button>
                )}</Td>
              </>
            )} />
        </Card>
      </div>

      {adding === 'funding' && (
        <FundingModal sources={catalogue.sources} onClose={() => setAdding(null)}
          onSave={async (body) => { await act(() => api.addFunding(body), 'Funding entry recorded.'); setAdding(null); }} />
      )}
      {adding === 'parked' && (
        <ParkedModal buckets={catalogue.buckets} onClose={() => setAdding(null)}
          onSave={async (body) => { await act(() => api.addParked(body), 'Parked balance updated.'); setAdding(null); }} />
      )}
    </div>
  );
}

function FundingModal({ sources, onClose, onSave }) {
  const [f, setF] = useState({ date: today(), source: sources[0], counterparty: '', direction: 'in',
    amount: '', rate: '0', maturity: '', remarks: '' });
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));
  return (
    <Modal title="Record a funding entry" size="lg" onClose={onClose}
      subtitle="Money in or out of the lending pool — a director infusion, a bank line drawn, a facility repaid."
      footer={<>
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn btn-p" disabled={!(+f.amount > 0)}
          onClick={() => onSave({ ...f, amount: +f.amount, rate: +f.rate || 0, maturity: f.maturity || undefined })}>
          Record it
        </button>
      </>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Value date"><input className="inp" type="date" value={f.date} onChange={set('date')} /></Field>
        <Field label="Source">
          <select className="inp" value={f.source} onChange={set('source')}>{sources.map((s) => <option key={s}>{s}</option>)}</select>
        </Field>
        <Field label="Counterparty"><input className="inp" value={f.counterparty} onChange={set('counterparty')} placeholder="e.g. HDFC Bank" /></Field>
        <Field label="Direction">
          <select className="inp" value={f.direction} onChange={set('direction')}>
            <option value="in">In — infusion or drawdown received</option>
            <option value="out">Out — repaid or withdrawn</option>
          </select>
        </Field>
        <Field label="Amount (₹)"><input className="inp" type="number" value={f.amount} onChange={set('amount')} /></Field>
        <Field label="Rate % p.a." hint="Zero for director capital — it is excluded from the blended cost.">
          <input className="inp" type="number" step="0.05" value={f.rate} onChange={set('rate')} />
        </Field>
        <Field label="Maturity" hint="Optional."><input className="inp" type="date" value={f.maturity} onChange={set('maturity')} /></Field>
        <Field label="Remarks" className="sm:col-span-2"><input className="inp" value={f.remarks} onChange={set('remarks')} /></Field>
      </div>
    </Modal>
  );
}

function ParkedModal({ buckets, onClose, onSave }) {
  const [f, setF] = useState({ asOf: today(), bucket: buckets[0], label: '', balance: '', note: '' });
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));
  return (
    <Modal title="Update a parked balance" onClose={onClose}
      subtitle="This sets the bucket as at the date rather than adding to it."
      footer={<>
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn btn-p" disabled={f.balance === ''} onClick={() => onSave({ ...f, balance: +f.balance })}>Save</button>
      </>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="As at"><input className="inp" type="date" value={f.asOf} onChange={set('asOf')} /></Field>
        <Field label="Bucket">
          <select className="inp" value={f.bucket} onChange={set('bucket')}>{buckets.map((b) => <option key={b}>{b}</option>)}</select>
        </Field>
        <Field label="Balance (₹)" hint="Zero closes the bucket out.">
          <input className="inp" type="number" min="0" value={f.balance} onChange={set('balance')} />
        </Field>
        <Field label="Label"><input className="inp" value={f.label} onChange={set('label')} placeholder="e.g. HDFC FD #2231" /></Field>
        <Field label="Note" className="sm:col-span-2"><input className="inp" value={f.note} onChange={set('note')} /></Field>
      </div>
    </Modal>
  );
}
