import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Briefcase, ChevronRight, Plus, Search, X } from 'lucide-react';
import { uw } from '../../api.js';
import { Card, Chip, Empty, ErrorNote, Field, Modal, PageHead, Spinner, Stat, Table, Td, useToast } from '../../ui.jsx';
import { useDebounced, useLoad, useLocal } from '../../hooks.js';
import { fmtDate } from '../../format.js';
import { CASE_STATUS, rupeesShort } from '../../uwFormat.js';

const FILTERS = [
  ['', 'All'], ['open,sent_back', 'With analyst'], ['submitted', 'With checker'],
  ['recommended', 'With sanction authority'], ['approved,approved_modified,declined', 'Decided']
];

/* Spec §10 "Pipeline and case": status, facility, analyst, due items, revision. */
export default function UwCases() {
  const nav = useNavigate();
  const [term, setTerm] = useState('');
  const q = useDebounced(term, 250);
  const [status, setStatus] = useLocal('uw.cases.status', '');
  const [mine, setMine] = useLocal('uw.cases.mine', false);
  const [adding, setAdding] = useState(false);
  const { data, error, loading, reload } = useLoad(() => uw.cases({ q, status, mine: mine ? 1 : '' }), [q, status, mine]);
  const rows = data || [];
  const count = (st) => rows.filter((r) => st.split(',').includes(r.status)).length;

  return (
    <div className="space-y-5">
      <PageHead icon={Briefcase} title="Underwriting cases"
        subtitle="Phase 1: uploaded evidence and public checks become reviewable credit analysis and a cited memo. Calculations and policy run as approved, versioned rules; nothing here creates a disbursement.">
        <button className="btn btn-p" onClick={() => setAdding(true)}><Plus size={15} /> New case</button>
      </PageHead>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="With analyst" value={count('open,sent_back')} accent="cyan" />
        <Stat label="With checker" value={count('submitted')} accent="violet" />
        <Stat label="With sanction authority" value={count('recommended')} accent="pink" />
        <Stat label="Decided" value={count('approved,approved_modified,declined')} accent="lime" />
      </div>

      <Card>
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <label className="relative min-w-[15rem] flex-1">
            <span className="lbl">Search</span>
            <Search size={15} className="pointer-events-none absolute bottom-2.5 left-3 text-slate-500" />
            <input className="inp pl-9" value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Borrower, case code, PAN, GSTIN or CIN…" />
          </label>
          <Field label="Stage" className="w-56">
            <select className="inp" value={status} onChange={(e) => setStatus(e.target.value)}>
              {FILTERS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </Field>
          <label className="mb-2.5 flex items-center gap-2 text-sm text-slate-300">
            <input type="checkbox" checked={!!mine} onChange={(e) => setMine(e.target.checked)} /> Assigned to me
          </label>
          {loading && <span className="pb-2.5 text-slate-500"><Spinner /></span>}
        </div>
        {error ? <ErrorNote onRetry={reload}>{error}</ErrorNote> : (
          <Table loading={loading && !data} rows={rows}
            cols={['Case', 'Stage', '#Requested', 'Analyst', 'Open items', 'Due', 'Updated', '']}
            empty={<Empty icon={Briefcase} title="No cases" action={<button className="btn btn-p" onClick={() => setAdding(true)}><Plus size={15} /> Open the first case</button>}>
              A case starts with the borrower's identity and the facility requested; evidence is uploaded next.
            </Empty>}
            render={(c) => {
              const st = CASE_STATUS[c.status] || {};
              const items = [
                c.quarantined ? c.quarantined + ' quarantined' : null,
                c.checksPending ? c.checksPending + ' check(s) pending' : null,
                c.questionsOpen ? c.questionsOpen + ' question(s) open' : null
              ].filter(Boolean);
              const overdue = c.dueDate && c.dueDate < new Date().toISOString().slice(0, 10) && ['open', 'sent_back', 'submitted', 'recommended'].includes(c.status);
              return (
                <>
                  <td>
                    <button className="group text-left" onClick={() => nav('/uw/cases/' + c.id)}>
                      <span className="font-semibold text-slate-100 group-hover:text-neon-violet">{c.legalName}</span>
                      <span className="mt-0.5 block text-[11px] text-slate-500">{c.caseCode} · {c.product} · {c.tenorDays} days · r{c.revision} · {c.docCount} file(s), {c.factCount} fact(s)</span>
                    </button>
                  </td>
                  <Td><Chip cls={st.cls}>{st.label || c.status}</Chip></Td>
                  <Td r className="font-semibold text-slate-100">{rupeesShort(c.requestedPaise)}</Td>
                  <Td className="text-slate-400">{c.analystName || '—'}</Td>
                  <Td>{items.length ? items.map((t) => <Chip key={t} cls="chip-warn" className="mr-1">{t}</Chip>) : <span className="text-slate-600">—</span>}</Td>
                  <Td className={overdue ? 'text-rose-300' : 'text-slate-400'}>{c.dueDate ? fmtDate(c.dueDate) : '—'}</Td>
                  <Td className="whitespace-nowrap text-slate-500">{fmtDate(c.updatedAt, true)}</Td>
                  <Td><button className="btn btn-ghost btn-xs" onClick={() => nav('/uw/cases/' + c.id)} aria-label={'Open ' + c.caseCode}><ChevronRight size={16} /></button></Td>
                </>
              );
            }} />
        )}
      </Card>

      {adding && <NewCase onClose={() => setAdding(false)} onDone={(c) => { setAdding(false); nav('/uw/cases/' + c.id); }} />}
    </div>
  );
}

function NewCase({ onClose, onDone }) {
  const toast = useToast();
  const { data: meta } = useLoad(() => uw.meta(), []);
  const [busy, setBusy] = useState(false);
  const [aliasIn, setAliasIn] = useState('');
  const [f, setF] = useState({
    legalName: '', entityType: 'company', cin: '', pan: '', gstin: '', aliases: [],
    product: '', requestedAmount: '', tenorDays: '90', purpose: '', repaymentSource: '', sector: '', vintageYears: '', dueDate: '', analystId: ''
  });
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));
  const products = (meta && meta.products.filter((p) => p.active)) || [];
  const product = f.product || (products[0] && products[0].key) || '';

  const save = async () => {
    setBusy(true);
    try {
      const c = await uw.createCase({
        party: { legalName: f.legalName, entityType: f.entityType, cin: f.cin, pan: f.pan, gstin: f.gstin, aliases: f.aliases },
        product, requestedAmount: f.requestedAmount, tenorDays: Number(f.tenorDays), purpose: f.purpose, repaymentSource: f.repaymentSource,
        sector: f.sector, vintageYears: f.vintageYears, dueDate: f.dueDate || null, analystId: f.analystId || null
      });
      toast(c.caseCode + ' opened — upload the evidence next.');
      onDone(c);
    } catch (e) { toast(e.message, 'err'); setBusy(false); }
  };
  const ready = f.legalName.trim() && product && f.requestedAmount.trim() && Number(f.tenorDays) > 0 && f.purpose.trim() && f.repaymentSource.trim();

  return (
    <Modal title="New underwriting case" size="lg" onClose={onClose}
      subtitle="Identity first: identifiers are used to match documents and public records to this borrower."
      footer={<><button className="btn" onClick={onClose} disabled={busy}>Cancel</button>
        <button className="btn btn-p" onClick={save} disabled={busy || !ready}>{busy && <Spinner />}Open case</button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Legal name" className="sm:col-span-2"><input className="inp" autoFocus value={f.legalName} onChange={set('legalName')} /></Field>
        <Field label="Entity type">
          <select className="inp" value={f.entityType} onChange={set('entityType')}>
            {['company', 'llp', 'partnership', 'proprietorship', 'other'].map((x) => <option key={x}>{x}</option>)}
          </select>
        </Field>
        <Field label="CIN (if applicable)"><input className="inp uppercase" value={f.cin} onChange={set('cin')} maxLength={24} /></Field>
        <Field label="PAN"><input className="inp uppercase" value={f.pan} onChange={set('pan')} maxLength={10} placeholder="AAAAA9999A" /></Field>
        <Field label="GSTIN"><input className="inp uppercase" value={f.gstin} onChange={set('gstin')} maxLength={15} /></Field>
        <Field label="Other names / aliases" className="sm:col-span-2" hint="Trading names used in documents. Names on documents are checked against these.">
          <div className="flex gap-2">
            <input className="inp" value={aliasIn} onChange={(e) => setAliasIn(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && aliasIn.trim()) { e.preventDefault(); setF((s) => ({ ...s, aliases: [...s.aliases, aliasIn.trim()] })); setAliasIn(''); } }} />
            <button type="button" className="btn shrink-0" disabled={!aliasIn.trim()}
              onClick={() => { setF((s) => ({ ...s, aliases: [...s.aliases, aliasIn.trim()] })); setAliasIn(''); }}><Plus size={14} /> Add</button>
          </div>
          {!!f.aliases.length && <div className="mt-2 flex flex-wrap gap-1.5">{f.aliases.map((a) => (
            <button key={a} type="button" className="chip-violet" onClick={() => setF((s) => ({ ...s, aliases: s.aliases.filter((x) => x !== a) }))}>{a} <X size={11} /></button>
          ))}</div>}
        </Field>
        <Field label="Product">
          <select className="inp" value={product} onChange={set('product')}>
            {products.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
          </select>
        </Field>
        <Field label="Requested amount (₹)" hint="Exact rupees, e.g. 50,00,000"><input className="inp" value={f.requestedAmount} onChange={set('requestedAmount')} inputMode="decimal" /></Field>
        <Field label="Requested tenor (days)"><input className="inp" type="number" min="1" value={f.tenorDays} onChange={set('tenorDays')} /></Field>
        <Field label="Sector"><input className="inp" value={f.sector} onChange={set('sector')} /></Field>
        <Field label="Borrower vintage (years)" hint="Drives how many years of financials the checklist asks for."><input className="inp" type="number" min="0" step="0.5" value={f.vintageYears} onChange={set('vintageYears')} /></Field>
        <Field label="Due date"><input className="inp" type="date" value={f.dueDate} onChange={set('dueDate')} /></Field>
        <Field label="Assigned analyst">
          <select className="inp" value={f.analystId} onChange={set('analystId')}>
            <option value="">Me</option>
            {((meta && meta.users) || []).map((u) => <option key={u.id} value={u.id}>{u.name} ({u.role})</option>)}
          </select>
        </Field>
        <Field label="Purpose" className="sm:col-span-2"><textarea className="inp min-h-16" value={f.purpose} onChange={set('purpose')} /></Field>
        <Field label="Repayment source" className="sm:col-span-2"><textarea className="inp min-h-16" value={f.repaymentSource} onChange={set('repaymentSource')} /></Field>
      </div>
    </Modal>
  );
}
