import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, ClipboardCheck, Download, FilePlus2, Plus, Search, SlidersHorizontal, X } from 'lucide-react';
import { api, downloadCSV } from '../api.js';
import { useAuth } from '../App.jsx';
import {
  Card, Chip, Empty, ErrorNote, Field, Modal, PageHead, Spinner, Stat, Table, Td, useToast
} from '../ui.jsx';
import { ProductChip, StageChip, VerdictChip } from '../components/LosChips.jsx';
import { useDebounced, useLoad, useLocal } from '../hooks.js';
import { fmtCr, fmtDate, today, LOS_PRODUCT } from '../format.js';

const STAGES = ['Docs Pending', 'Policy Check', 'CAM', 'CAM Pending', 'Approved', 'Declined', 'Sanctioned', 'Disbursed'];
const ENTITY_TYPES = ['Private Limited', 'LLP', 'Partnership', 'Proprietorship', 'Public Limited'];
const OPEN_STAGES = ['Docs Pending', 'Policy Check', 'CAM', 'CAM Pending', 'Approved'];

export default function Applications({ autoNew = false }) {
  const user = useAuth();
  const nav = useNavigate();
  const toast = useToast();
  const canEdit = user.role === 'director' || user.role === 'manager';

  const [term, setTerm] = useState('');
  const q = useDebounced(term, 250);
  const [stage, setStage] = useLocal('applications.stage', '');
  const [product, setProduct] = useLocal('applications.product', '');
  const [sort, setSort] = useLocal('applications.sort', 'updatedAt');

  const [adding, setAdding] = useState(autoNew);
  const [view, setView] = useLocal('applications.view', 'list');

  const { data, error, loading, reload } = useLoad(() => api.applications({ q, stage, product }), [q, stage, product]);
  const { data: funnel, reload: reloadFunnel } = useLoad(() => api.applicationFunnel(), []);

  /* The API returns newest-first; sorting is a view preference, so it stays on
     this side rather than adding a query parameter for each column. */
  const rows = (data || []).slice().sort((a, b) => {
    if (sort === 'legalName') return a.legalName.localeCompare(b.legalName);
    if (sort === 'requestedAmount') return b.requestedAmount - a.requestedAmount;
    if (sort === 'stage') return STAGES.indexOf(a.stage) - STAGES.indexOf(b.stage);
    return String(b.updatedAt).localeCompare(String(a.updatedAt));
  });

  const counts = (funnel && funnel.counts) || {};
  const inPipeline = OPEN_STAGES.reduce((n, s) => n + (counts[s] || 0), 0);
  const docsPending = rows.filter((a) => a.missingDocs > 0).length;
  const sanctionedValue = rows.filter((a) => a.sanction).reduce((s, a) => s + (a.sanction.amount || 0), 0);
  const requestedTotal = rows.reduce((s, a) => s + a.requestedAmount, 0);

  const exportCSV = () => {
    downloadCSV('valuefin_applications_' + today() + '.csv',
      ['Application', 'Legal entity', 'Product', 'Requested', 'Stage', 'Policy verdict', 'Eligible', 'Grade',
        'Documents pending', 'Receivables tagged', 'Created by', 'Last updated'],
      rows.map((a) => [a.appCode, a.legalName, a.productName, Math.round(a.requestedAmount), a.stage,
        a.policyCheck ? a.policyCheck.verdict : '', a.policyCheck ? Math.round(a.policyCheck.eligible) : '',
        a.policyCheck ? a.policyCheck.score.grade : '', a.missingDocs, Math.round(a.receivableTotal),
        a.createdBy, String(a.updatedAt).slice(0, 10)]));
  };

  const filtered = !!(term || stage || product);

  return (
    <div className="space-y-5">
      <PageHead icon={ClipboardCheck} title="Applications"
        subtitle="Origination from proposal to sanction: the checklist, the credit policy run, the CAM and the Director's decision all live on the file.">
        <button className="btn" onClick={exportCSV} disabled={!rows.length}><Download size={15} /> CSV</button>
        {canEdit && <button className="btn btn-p" onClick={() => setAdding(true)}><Plus size={15} /> New application</button>}
      </PageHead>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={ClipboardCheck} label="In the pipeline" value={inPipeline} accent="violet"
          sub={(counts.Sanctioned || 0) + ' sanctioned · ' + (counts.Declined || 0) + ' declined'} />
        <Stat icon={FilePlus2} label="Waiting on documents" value={docsPending} accent="amber"
          sub={docsPending ? 'mandatory checklist rows outstanding' : 'every checklist is complete'} />
        <Stat icon={SlidersHorizontal} label="With the Director" value={counts['CAM Pending'] || 0} accent="cyan"
          sub={(counts.Approved || 0) + ' approved, awaiting sanction terms'} />
        <Stat icon={Download} label="Sanctioned value" value={fmtCr(sanctionedValue)} accent="lime"
          sub="limits opened from this pipeline" />
      </div>

      <Funnel counts={counts} stages={STAGES} active={stage} onPick={(x) => setStage(x === stage ? '' : x)} />

      <Card>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <Tabs value={view} onChange={setView}
            tabs={[['list', 'All applications', rows.length], ['board', 'Pipeline board'], ['docs', 'Docs pending', docsPending]]} />
        </div>

        <div className="mb-4 flex flex-wrap items-end gap-3">
          <label className="relative min-w-[15rem] flex-1">
            <span className="lbl">Search</span>
            <Search size={15} className="pointer-events-none absolute bottom-2.5 left-3 text-slate-500" />
            <input className="inp pl-9" value={term} onChange={(e) => setTerm(e.target.value)}
              placeholder="Entity, application code, PAN or promoter…" />
          </label>
          <Field label="Stage" className="w-48">
            <select className="inp" value={stage} onChange={(e) => setStage(e.target.value)}>
              <option value="">All stages</option>
              {STAGES.map((s) => <option key={s} value={s}>{s}{counts[s] ? ' (' + counts[s] + ')' : ''}</option>)}
            </select>
          </Field>
          <Field label="Product" className="w-44">
            <select className="inp" value={product} onChange={(e) => setProduct(e.target.value)}>
              <option value="">All products</option>
              {Object.entries(LOS_PRODUCT).map(([key, p]) => <option key={key} value={key}>{p.label}</option>)}
            </select>
          </Field>
          <Field label="Sort by" className="w-44">
            <select className="inp" value={sort} onChange={(e) => setSort(e.target.value)}>
              <option value="updatedAt">Last updated</option>
              <option value="requestedAmount">Requested amount</option>
              <option value="stage">Stage</option>
              <option value="legalName">Entity (A–Z)</option>
            </select>
          </Field>
          {filtered && (
            <button className="btn btn-xs mb-2.5" onClick={() => { setTerm(''); setStage(''); setProduct(''); }}>
              <X size={12} /> Clear
            </button>
          )}
          {loading && <span className="pb-2.5 text-slate-500"><Spinner /></span>}
        </div>

        {error ? <ErrorNote onRetry={() => { reload(); reloadFunnel(); }}>{error}</ErrorNote>
          : view === 'board' ? <Board rows={rows} loading={loading} onOpen={(a) => nav('/applications/' + a.id)} />
          : view === 'docs' ? <DocsQueue rows={rows.filter((a) => a.missingDocs > 0)} loading={loading} onOpen={(a) => nav('/applications/' + a.id)} />
          : (
          <Table loading={loading && !data} rows={rows}
            cols={['Application', 'Product', '#Requested', 'Stage', 'Policy verdict', 'Documents', 'Updated', '']}
            empty={<Empty icon={FilePlus2} title={filtered ? 'No applications match those filters' : 'No applications yet'}
              action={canEdit && !filtered
                ? <button className="btn btn-p" onClick={() => setAdding(true)}><Plus size={15} /> Create the first application</button>
                : null}>
              {filtered
                ? 'Clear the search, stage or product filter to see the whole pipeline.'
                : 'Every facility starts here — record the proposal, file the checklist and run the credit policy.'}
            </Empty>}
            render={(a) => (
              <>
                <td>
                  <button className="group text-left" onClick={() => nav('/applications/' + a.id)}>
                    <span className="flex items-center gap-2">
                      <span className="font-semibold text-slate-100 transition group-hover:text-neon-violet">{a.legalName}</span>
                      {a.devCount > 0 && <Chip cls="chip-warn">{a.devCount} deviation{a.devCount > 1 ? 's' : ''}</Chip>}
                    </span>
                    <span className="mt-0.5 block text-[11px] text-slate-500">
                      {a.appCode} · {a.sector || 'sector not set'} · {a.tenorDays} days · by {a.createdBy}
                    </span>
                  </button>
                </td>
                <Td><ProductChip product={a.product} label={a.productName} /></Td>
                <Td r className="font-semibold text-slate-100">{fmtCr(a.requestedAmount)}</Td>
                <Td><StageChip stage={a.stage} /></Td>
                <Td>
                  {a.policyCheck ? (
                    <>
                      <VerdictChip verdict={a.policyCheck.verdict} />
                      <span className="num mt-1 block text-[11px] text-slate-500">
                        eligible {fmtCr(a.policyCheck.eligible)} · grade {a.policyCheck.score.grade}
                      </span>
                    </>
                  ) : <span className="text-slate-500">not run</span>}
                </Td>
                <Td>{a.missingDocs
                  ? <Chip cls="chip-warn">{a.missingDocs} pending</Chip>
                  : <Chip cls="chip-good">complete</Chip>}</Td>
                <Td className="whitespace-nowrap text-slate-500">{fmtDate(a.updatedAt, true)}</Td>
                <Td>
                  <button className="btn btn-ghost btn-xs" onClick={() => nav('/applications/' + a.id)} aria-label={'Open ' + a.appCode}>
                    <ChevronRight size={16} />
                  </button>
                </Td>
              </>
            )}
            footer={rows.length > 1 ? (
              <tr className="border-t border-white/10">
                <td className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  {rows.length} applications
                </td>
                <td />
                <td className="num px-3 text-right font-semibold text-white">{fmtCr(requestedTotal)}</td>
                <td colSpan={5} />
              </tr>
            ) : null} />
        )}
      </Card>

      {adding && (
        <ApplicationForm onClose={() => setAdding(false)}
          onDone={(app) => {
            setAdding(false);
            toast(app.appCode + ' created — file the checklist next.');
            nav('/applications/' + app.id);
          }} />
      )}
    </div>
  );
}

/* ============================================================================
   The origination funnel — one bar per stage, in workflow order
   ========================================================================== */
function Funnel({ counts, stages, active, onPick }) {
  const peak = Math.max(1, ...stages.map((s) => counts[s] || 0));
  const total = stages.reduce((n, s) => n + (counts[s] || 0), 0);
  return (
    <Card title="Origination funnel" subtitle={total + ' file(s) on record · click a stage to filter the list'}>
      <div className="space-y-1">
        {stages.map((s) => {
          const n = counts[s] || 0;
          return (
            <button key={s} onClick={() => onPick(s)}
              className={'flex w-full items-center gap-3 rounded-xl px-2 py-1.5 text-left transition hover:bg-white/[.05] '
                + (active === s ? 'bg-white/[.07]' : '')}>
              <span className={'w-32 shrink-0 text-right text-xs ' + (active === s ? 'text-slate-200' : 'text-slate-400')}>{s}</span>
              <span className="h-3.5 flex-1 overflow-hidden rounded-full bg-white/[.06]">
                <span className={'block h-full rounded-full transition-[width] duration-700 '
                  + (s === 'Declined' ? 'bg-state-bad/70' : 'bg-gradient-to-r from-neon-indigo to-neon-cyan')}
                  style={{ width: Math.max(3, Math.round((n / peak) * 100)) + '%' }} />
              </span>
              <span className="num w-8 shrink-0 text-right text-[13px] font-bold text-slate-200">{n}</span>
            </button>
          );
        })}
      </div>
    </Card>
  );
}

/* Where every file is sitting, at a glance — the column a file is stuck in is
   the question this view answers. */
function Board({ rows, loading, onOpen }) {
  if (loading) return <p className="py-10 text-center text-sm text-slate-500"><Spinner /> Loading the pipeline…</p>;
  return (
    <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-2">
      {STAGES.map((s) => {
        const col = rows.filter((a) => a.stage === s);
        return (
          <div key={s} className="w-[15rem] shrink-0 rounded-2xl border border-white/8 bg-white/[.025] p-2.5">
            <div className="mb-2 flex items-center justify-between px-1">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{s}</span>
              <span className="num rounded-full bg-white/[.08] px-2 text-[11px] text-slate-300">{col.length}</span>
            </div>
            <div className="space-y-2">
              {col.map((a) => (
                <button key={a.id} onClick={() => onOpen(a)}
                  className="block w-full rounded-xl border border-white/10 bg-ink-900/60 p-2.5 text-left transition hover:border-neon-indigo/40 hover:bg-white/[.06]">
                  <span className="block truncate font-mono text-[11px] font-semibold text-slate-300">{a.appCode}</span>
                  <span className="block truncate text-[12.5px] text-slate-100">{a.legalName}</span>
                  <span className="mt-1 block text-[11px] text-slate-500">
                    {a.productName} · {fmtCr(a.requestedAmount)}
                    {a.missingDocs > 0 && <span className="block text-neon-amber">{a.missingDocs} document(s) pending</span>}
                  </span>
                </button>
              ))}
              {!col.length && <p className="px-1 py-3 text-center text-[11px] text-slate-600">Empty</p>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* Everything held up on a borrower rather than on us. */
function DocsQueue({ rows, loading, onOpen }) {
  if (loading) return <p className="py-10 text-center text-sm text-slate-500"><Spinner /> Loading…</p>;
  if (!rows.length) {
    return <Empty icon={FilePlus2} title="Every checklist is complete">No application is waiting on a document.</Empty>;
  }
  return (
    <div className="space-y-3">
      {rows.map((a) => (
        <div key={a.id} className="rounded-2xl border border-white/10 bg-white/[.03] p-3.5">
          <div className="flex flex-wrap items-center gap-2">
            <b className="text-slate-100">{a.appCode} · {a.legalName}</b>
            <StageChip stage={a.stage} />
            <span className="text-[11px] text-slate-500">{a.missingDocs} outstanding</span>
            <button className="btn btn-xs ml-auto" onClick={() => onOpen(a)}>Open &amp; upload</button>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {a.documents.filter((d) => d.mandatory && d.status !== 'uploaded').map((d) => (
              <Chip key={d.key} cls="chip-warn">{d.label}</Chip>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ============================================================================
   New application — the proposal, before any borrower record exists
   ========================================================================== */
function ApplicationForm({ onClose, onDone }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [vcInput, setVcInput] = useState('');
  const [f, setF] = useState({
    legalName: '', entityType: 'Private Limited', sector: '', product: 'quick_cash', requestedAmount: '',
    purpose: '', tenureValue: '90', tenureUnit: 'days', promoterName: '', promoterMobile: '',
    companyPan: '', gstin: '', repaymentSource: '', vcs: []
  });
  const { data: cfg } = useLoad(() => api.settings(), []);
  const { data: funds } = useLoad(() => api.investors(), []);
  const set = (key) => (e) => setF((s) => ({ ...s, [key]: e.target.value }));

  const addVc = () => {
    const v = vcInput.trim();
    if (!v) return;
    setF((s) => (s.vcs.includes(v) ? s : { ...s, vcs: [...s.vcs, v] }));
    setVcInput('');
  };

  const save = async () => {
    setBusy(true);
    try { onDone(await api.createApplication(f)); }
    catch (e) { toast(e.message, 'err'); setBusy(false); }
  };

  const sectors = cfg ? cfg.catalogue.sectors : [];
  const noGo = cfg ? cfg.catalogue.noGo.filter((s) => s !== 'wilful default') : [];
  const product = cfg && cfg.catalogue.products.find((p) => p.key === f.product);
  const ready = f.legalName.trim() && +f.requestedAmount > 0 && f.purpose.trim() && f.repaymentSource.trim()
    && f.promoterName.trim() && f.promoterMobile.trim();

  return (
    <Modal title="New application" size="lg"
      subtitle="The borrower record is created at sanction. Anything missing from the checklist parks the file under Docs Pending."
      onClose={onClose}
      footer={<>
        <button className="btn" disabled={busy} onClick={onClose}>Cancel</button>
        <button className="btn btn-p" disabled={busy || !ready} onClick={save}>{busy && <Spinner />}Create application</button>
      </>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Legal entity name" className="sm:col-span-2">
          <input className="inp" autoFocus value={f.legalName} onChange={set('legalName')}
            placeholder="e.g. Griot Retail Tech Private Limited" />
        </Field>
        <Field label="Entity type">
          <select className="inp" value={f.entityType} onChange={set('entityType')}>
            {ENTITY_TYPES.map((t) => <option key={t}>{t}</option>)}
          </select>
        </Field>
        <Field label="Sector" hint="A no-go sector is a policy hard stop.">
          <select className="inp" value={f.sector} onChange={set('sector')}>
            <option value="">— select —</option>
            {sectors.map((s) => <option key={s}>{s}</option>)}
            {noGo.map((s) => <option key={s} value={s}>⛔ {s} (no-go)</option>)}
          </select>
        </Field>
        <Field label="Product" hint={product ? product.floor + '% floor · ticket ' + fmtCr(product.min) + '–' + fmtCr(product.max) : null}>
          <select className="inp" value={f.product} onChange={set('product')}>
            {Object.entries(LOS_PRODUCT).map(([key, p]) => <option key={key} value={key}>{p.label} — {p.blurb}</option>)}
          </select>
        </Field>
        <Field label="Requested amount (₹)">
          <input className="inp" type="number" min="1" value={f.requestedAmount} onChange={set('requestedAmount')} />
        </Field>
        <Field label="Tenure">
          <input className="inp" type="number" min="1" value={f.tenureValue} onChange={set('tenureValue')} />
        </Field>
        <Field label="Tenure unit">
          <select className="inp" value={f.tenureUnit} onChange={set('tenureUnit')}>
            <option value="days">Days</option><option value="months">Months</option>
          </select>
        </Field>
        <Field label="Promoter name"><input className="inp" value={f.promoterName} onChange={set('promoterName')} /></Field>
        <Field label="Promoter mobile"><input className="inp" value={f.promoterMobile} onChange={set('promoterMobile')} /></Field>
        <Field label="Company PAN"><input className="inp uppercase" maxLength={10} value={f.companyPan} onChange={set('companyPan')} /></Field>
        <Field label="GSTIN"><input className="inp uppercase" maxLength={15} value={f.gstin} onChange={set('gstin')} /></Field>
        <Field label="Purpose" className="sm:col-span-2">
          <textarea className="inp min-h-20" value={f.purpose} onChange={set('purpose')}
            placeholder="e.g. PO-backed working capital for anchor orders" />
        </Field>
        <Field label="Repayment source" className="sm:col-span-2">
          <textarea className="inp min-h-20" value={f.repaymentSource} onChange={set('repaymentSource')}
            placeholder="e.g. platform settlements routed to the collection account" />
        </Field>
        <Field label="VC / investor tags" className="sm:col-span-2"
          hint="Every borrower carries its backing fund(s) — this drives the §7 concentration cap.">
          <div className="flex gap-2">
            <input className="inp" list="vc-options" value={vcInput} onChange={(e) => setVcInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addVc(); } }}
              placeholder="e.g. Stellaris Venture Partners" />
            <datalist id="vc-options">
              {(funds || []).map((i) => <option key={i.id} value={i.name} />)}
            </datalist>
            <button type="button" className="btn shrink-0" onClick={addVc}><Plus size={14} /> Tag</button>
          </div>
          {!!f.vcs.length && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {f.vcs.map((v) => (
                <button key={v} type="button" className="chip-violet"
                  onClick={() => setF((s) => ({ ...s, vcs: s.vcs.filter((x) => x !== v) }))}>
                  {v} <X size={11} />
                </button>
              ))}
            </div>
          )}
        </Field>
      </div>
    </Modal>
  );
}
