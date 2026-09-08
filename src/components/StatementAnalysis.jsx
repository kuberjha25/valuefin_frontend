import React, { useState } from 'react';
import { AlertTriangle, CheckCircle2, FileSearch, Info, ScanText, Sparkles, TriangleAlert } from 'lucide-react';
import { api } from '../api.js';
import { Card, Chip, ErrorNote, Spinner, Table, Td, useToast } from '../ui.jsx';
import { fmt, fmtCr, fmtDate } from '../format.js';

/* ============================================================================
   What the platform read out of an uploaded PDF.

   The text comes from the document's own text layer where it has one, and from
   Amazon Textract where it does not; the panel says which, because a figure
   recognised from a photograph deserves a second look and one lifted from a
   text layer does not.
   ========================================================================== */

const TONE = {
  good: { cls: 'border-state-good/25 bg-state-good/[.06]', icon: CheckCircle2, colour: 'text-emerald-300' },
  warn: { cls: 'border-neon-amber/25 bg-neon-amber/[.06]', icon: TriangleAlert, colour: 'text-neon-amber' },
  bad: { cls: 'border-state-bad/25 bg-state-bad/[.06]', icon: AlertTriangle, colour: 'text-rose-300' },
  info: { cls: 'border-white/8 bg-white/[.03]', icon: Info, colour: 'text-slate-400' }
};

const SOURCE = {
  text: { label: 'read from the text layer', cls: 'chip-good' },
  ocr: { label: 'recognised by Textract', cls: 'chip-warn' },
  mixed: { label: 'text layer + Textract', cls: 'chip-warn' }
};

export default function StatementAnalysis({ doc, onAnalysed }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [showRows, setShowRows] = useState(false);
  const a = doc.analysis;

  const run = async (refresh) => {
    setBusy(true); setError(null);
    try {
      const updated = await api.analyseDocument(doc.id, refresh);
      onAnalysed(updated);
      toast(updated.analysis && updated.analysis.kind === 'bank_statement'
        ? 'Read ' + updated.analysis.transactionCount + ' transactions from the statement.'
        : 'Document read — no statement rows recognised.');
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };

  if (!a) {
    return (
      <div className="rounded-2xl border border-white/8 bg-white/[.03] px-4 py-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-neon-indigo/25 bg-neon-indigo/15">
            <ScanText size={17} className="text-neon-violet" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-slate-100">Read this document</p>
            <p className="text-[12px] text-slate-500">
              Pulls the text out — from the PDF's text layer, or by Textract if it is a scan — and, for a bank
              statement, summarises the inflow, the balance behaviour and anything that bounced.
            </p>
          </div>
          <button className="btn btn-p shrink-0" disabled={busy} onClick={() => run(false)}>
            {busy ? <Spinner /> : <Sparkles size={15} />} Analyse
          </button>
        </div>
        {error && <div className="mt-3"><ErrorNote onRetry={() => run(false)}>{error}</ErrorNote></div>}
      </div>
    );
  }

  const src = SOURCE[a.source] || SOURCE.text;
  const s = a.summary;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Chip cls={a.kind === 'bank_statement' ? 'chip-violet' : 'chip-slate'}>
          {a.kind === 'bank_statement' ? 'Bank statement' : 'Unrecognised document'}
        </Chip>
        <Chip cls={src.cls}>{src.label}</Chip>
        <Chip cls="chip-slate">{a.pages} page(s) · {a.transactionCount} transaction(s)</Chip>
        {a.reconciliation && (
          <Chip cls={a.reconciliation.creditsMatch && a.reconciliation.debitsMatch && a.reconciliation.closingMatch
            ? 'chip-good' : 'chip-warn'}>
            {a.reconciliation.creditsMatch && a.reconciliation.debitsMatch && a.reconciliation.closingMatch
              ? 'reconciles with the bank’s own totals' : 'does not fully reconcile'}
          </Chip>
        )}
        <span className="ml-auto text-[11px] text-slate-500">
          {a.by} · {fmtDate(a.at, true)} · {a.ms} ms
        </span>
        <button className="btn btn-xs" disabled={busy} onClick={() => run(true)}>
          {busy ? <Spinner /> : <FileSearch size={12} />} Re-read
        </button>
      </div>

      {error && <ErrorNote onRetry={() => run(true)}>{error}</ErrorNote>}

      {/* ---- the bullets ---- */}
      <div className="space-y-1.5">
        {a.bullets.map((b, i) => {
          const t = TONE[b.tone] || TONE.info;
          const Icon = t.icon;
          return (
            <div key={i} className={'flex items-start gap-2.5 rounded-xl border px-3 py-2 text-[13px] ' + t.cls}>
              <Icon size={14} className={'mt-0.5 shrink-0 ' + t.colour} />
              <span className="leading-snug text-slate-200">{b.text}</span>
            </div>
          );
        })}
      </div>

      {s && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Tile label="Total credits" value={fmtCr(s.totalCredit)} sub={s.creditCount + ' credit(s)'} tone="text-emerald-300" />
            <Tile label="Total debits" value={fmtCr(s.totalDebit)} sub={s.debitCount + ' debit(s)'} tone="text-rose-300" />
            <Tile label="Average monthly inflow" value={fmtCr(s.avgMonthlyCredit)} sub={'over ' + s.period.monthsCovered + ' month(s)'} />
            <Tile label="Average balance" value={fmt(s.avgBalance)} sub={'low ' + fmt(s.minBalance) + ' · high ' + fmt(s.maxBalance)} />
          </div>

          {!!s.monthly.length && (
            <Card title="Month by month">
              <Table cols={['Month', '#Credits', '#Debits', '#Net', '#Entries']} rows={s.monthly.map((m) => ({ ...m, id: m.month }))}
                render={(m) => (
                  <>
                    <td className="text-slate-200">{m.label}</td>
                    <Td r className="text-emerald-300">{fmt(m.credit)}</Td>
                    <Td r className="text-rose-300">{fmt(m.debit)}</Td>
                    <Td r className={m.credit - m.debit >= 0 ? 'text-slate-100' : 'text-rose-300'}>{fmt(m.credit - m.debit)}</Td>
                    <Td r className="text-slate-500">{m.count}</Td>
                  </>
                )} />
            </Card>
          )}

          {!!s.topCredits.length && (
            <Card title="Where the money comes from">
              <Table cols={['Payer', '#Received', '#Share of credits']} rows={s.topCredits.map((c, i) => ({ ...c, id: i }))}
                render={(c) => (
                  <>
                    <td className="text-slate-200">{c.name}</td>
                    <Td r>{fmt(c.amount)}</Td>
                    <Td r className={c.share >= 40 ? 'text-neon-amber' : 'text-slate-400'}>{c.share}%</Td>
                  </>
                )} />
            </Card>
          )}

          {!!s.returns.count && (
            <Card title="Returned and reversed instruments">
              <Table cols={['Date', 'Narration', '#Amount']} rows={s.returns.items.map((r, i) => ({ ...r, id: i }))}
                render={(r) => (
                  <>
                    <Td className="whitespace-nowrap text-slate-400">{fmtDate(r.date)}</Td>
                    <td className="text-slate-300">{r.narration}</td>
                    <Td r className="text-rose-300">{fmt(r.amount)}</Td>
                  </>
                )} />
            </Card>
          )}

          {!!(a.transactions || []).length && (
            <div>
              <button className="btn btn-xs" onClick={() => setShowRows((v) => !v)}>
                {showRows ? 'Hide' : 'Show'} the {a.transactions.length} transaction(s) read
              </button>
              {showRows && (
                <div className="mt-3 max-h-[26rem] overflow-y-auto rounded-2xl border border-white/8">
                  <Table cols={['Date', 'Narration', 'Direction', '#Amount', '#Balance']}
                    rows={a.transactions.map((t, i) => ({ ...t, id: i }))}
                    render={(t) => (
                      <>
                        <Td className="whitespace-nowrap text-slate-400">{fmtDate(t.date)}</Td>
                        <td className="max-w-[26rem] truncate text-slate-300" title={t.narration}>{t.narration}</td>
                        <Td>
                          <Chip cls={t.direction === 'credit' ? 'chip-good' : 'chip-slate'}>{t.direction}</Chip>
                        </Td>
                        <Td r className={t.direction === 'credit' ? 'text-emerald-300' : 'text-rose-300'}>{fmt(t.amount)}</Td>
                        <Td r className={t.balance < 0 ? 'text-rose-300' : 'text-slate-400'}>{fmt(t.balance)}</Td>
                      </>
                    )} />
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

const Tile = ({ label, value, sub, tone = 'text-slate-100' }) => (
  <div className="card-tight">
    <p className="text-[10px] font-semibold uppercase tracking-[.12em] text-slate-500">{label}</p>
    <p className={'font-display text-lg font-bold leading-tight num mt-0.5 ' + tone}>{value}</p>
    {sub && <p className="mt-1 text-[11px] text-slate-500">{sub}</p>}
  </div>
);

/* ============================================================================
   Statement figures → the gate inputs they belong in.

   Only the fields a product's policy actually reads are offered: Quick Cash
   scores banking conduct off bounces, Rocket Fuel is sized off revenue and
   burn, Bullet off the monthly surplus. Everything is shown before it is
   written, with where it came from, so nobody is copying a number blind.
   ========================================================================== */
export function eligibilityFromStatement(analysis, product) {
  const s = analysis && analysis.summary;
  if (!s) return [];

  const period = s.period.monthsCovered + ' month(s) of statement';
  const rows = [{
    key: 'bounces12m',
    label: 'Instrument bounces in the last 12 months',
    value: s.returns.count,
    from: s.returns.count
      ? s.returns.count + ' returned or reversed instrument(s) over ' + period
      : 'nothing returned over ' + period
  }];

  if (product === 'rocket_fuel') {
    rows.push({
      key: 'avgMonthlyRevenue',
      label: 'Average monthly revenue — trailing 6 months',
      value: Math.round(s.avgMonthlyCredit),
      from: 'total credits ' + fmt(s.totalCredit) + ' spread over ' + period
    }, {
      key: 'monthlyBurn',
      label: 'Monthly burn',
      value: Math.round(s.avgMonthlyDebit),
      from: 'total debits ' + fmt(s.totalDebit) + ' spread over ' + period
    });
  }

  if (product === 'bullet') {
    rows.push({
      key: 'netCashSurplus',
      label: 'Average monthly net cash surplus',
      value: Math.round(s.avgMonthlyCredit - s.avgMonthlyDebit),
      from: 'credits less debits, averaged over ' + period
    });
  }

  return rows;
}

/* Whether the statement is long enough for a twelve-month conduct question to
   be answered honestly by it. */
export function shortPeriodWarning(analysis) {
  const months = analysis && analysis.summary && analysis.summary.period.monthsCovered;
  if (!months || months >= 12) return null;
  return 'This statement covers ' + months + ' month(s), not twelve. The bounce count is what happened in that ' +
    'window — a longer statement could show more, so treat it as a floor rather than the full picture.';
}
